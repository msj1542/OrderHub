"use server";

import { revalidatePath }      from "next/cache";
import { requireUser }         from "@/lib/auth";
import { can }                 from "@/lib/authz/policy";
import {
  createProduct,
  updateProduct,
  setProductMaterials,
  upsertPrice,
  addProductFile,
  setProductThumbnail,
  listProducts,
  getMaterial,
  listMaterials,
} from "@/lib/catalog/service";
import { parseCsv, validateProductImport, validatePricingImport, productRowToValues } from "@/lib/catalog/csv";
import { db } from "@/lib/db";
import { prices, products } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createClient }  from "@/lib/supabase/server";

// ── Product CRUD ──────────────────────────────────────────────

export type SaveProductState = {
  error?: string;
  success?: string;
};

export async function saveProductAction(
  _prev: SaveProductState,
  formData: FormData,
): Promise<SaveProductState> {
  const user = await requireUser();
  if (!can(user, "catalog:manage")) return { error: "Not authorized." };

  const id              = formData.get("id") as string | null;
  const brand           = formData.get("brand") as string;
  const model           = formData.get("model") as string;
  const yearStart       = (formData.get("yearStart") as string) || null;
  const partName        = formData.get("partName") as string;
  const attr1           = (formData.get("attr1") as string) || null;
  const attr2           = (formData.get("attr2") as string) || null;
  const description     = formData.get("description") as string;
  const includedPieces  = (formData.get("includedPieces") as string) || null;
  const patternLengthIn = (formData.get("patternLengthIn") as string) || null;
  const requiredRollWidthIn = (formData.get("requiredRollWidthIn") as string) || null;
  const isActive        = formData.get("isActive") === "true";
  const customerVisible = formData.get("customerVisible") === "true";
  const revision        = (formData.get("revision") as string) || null;
  const effectiveDate   = (formData.get("effectiveDate") as string) || new Date().toISOString().slice(0, 10);

  const materialIds     = (formData.getAll("materialIds") as string[]);
  // prices: material_id → unit_price pairs sent as "price_<materialId>"
  const allMaterials    = await listMaterials();

  if (!brand || !model || !partName || !description) {
    return { error: "Brand, model, part name, and description are required." };
  }

  try {
    let productId: string;

    if (id) {
      await updateProduct(id, {
        brand, model, yearStart, partName, attr1, attr2,
        description, includedPieces, patternLengthIn, requiredRollWidthIn,
        isActive, customerVisible, priceListRevision: revision, priceEffectiveDate: effectiveDate,
      });
      productId = id;
    } else {
      const sku = formData.get("sku") as string;
      if (!sku) return { error: "SKU is required for new products." };
      const product = await createProduct({
        sku, brand, model, yearStart, partName, attr1, attr2,
        description, includedPieces, patternLengthIn, requiredRollWidthIn,
        isActive, customerVisible, priceListRevision: revision, priceEffectiveDate: effectiveDate,
      });
      productId = product.id;
    }

    await setProductMaterials(productId, materialIds);

    for (const mat of allMaterials) {
      const priceStr = formData.get(`price_${mat.id}`) as string | null;
      if (priceStr && priceStr.trim() && materialIds.includes(mat.id)) {
        const price = parseFloat(priceStr);
        if (Number.isFinite(price) && price > 0) {
          await upsertPrice(productId, mat.id, price.toFixed(2), effectiveDate, revision);
        }
      }
    }

    revalidatePath("/catalog");
    revalidatePath("/settings/catalog");
    return { success: id ? "Product saved." : "Product created." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed.";
    return { error: msg };
  }
}

// ── File upload ───────────────────────────────────────────────

export type UploadFileState = {
  error?: string;
  success?: string;
};

export async function uploadProductFileAction(
  _prev: UploadFileState,
  formData: FormData,
): Promise<UploadFileState> {
  const user = await requireUser();
  if (!can(user, "catalog:manage")) return { error: "Not authorized." };

  const productId  = formData.get("productId") as string;
  const label      = formData.get("label") as string;
  const isThumbnail = formData.get("isThumbnail") === "true";
  const file        = formData.get("file") as File | null;

  if (!productId || !label || !file) {
    return { error: "Product, label, and file are required." };
  }

  try {
    const supabase  = await createClient();
    const ext       = file.name.split(".").pop();
    const filePath  = `products/${productId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("product-files")
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) throw new Error(uploadError.message);

    await addProductFile({
      productId,
      label,
      filePath,
      mimeType: file.type,
      isThumbnail,
    });

    revalidatePath("/catalog");
    revalidatePath("/settings/catalog");
    return { success: `${label} uploaded.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed.";
    return { error: msg };
  }
}

// ── Set thumbnail ─────────────────────────────────────────────

export async function setThumbnailAction(productId: string, fileId: string) {
  const user = await requireUser();
  if (!can(user, "catalog:manage")) throw new Error("Not authorized.");

  await setProductThumbnail(productId, fileId);
  revalidatePath("/catalog");
  revalidatePath("/settings/catalog");
}

// ── CSV Import ────────────────────────────────────────────────

export type ImportState = {
  report?: Record<string, unknown>;
  error?: string;
  applied?: boolean;
};

export async function previewImportAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireUser();
  if (!can(user, "catalog:manage")) return { error: "Not authorized." };

  const type    = formData.get("type") as "product" | "pricing";
  const csvText = formData.get("csv") as string;

  if (!csvText || !type) return { error: "Import type and CSV content are required." };

  try {
    const rows = parseCsv(csvText);
    const existing = await listProducts({ includeInactive: true });
    const existingSkus = new Set(existing.map((p) => p.sku));

    const report =
      type === "product"
        ? validateProductImport(rows, existingSkus)
        : validatePricingImport(rows, existingSkus);

    return { report: report as unknown as Record<string, unknown> };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Validation failed." };
  }
}

export async function applyImportAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireUser();
  if (!can(user, "catalog:manage")) return { error: "Not authorized." };

  const type       = formData.get("type") as "product" | "pricing";
  const csvText    = formData.get("csv") as string;
  const sourceName = formData.get("sourceName") as string;

  if (!csvText || !type) return { error: "Import type and CSV content are required." };

  try {
    const rows = parseCsv(csvText);
    const existing = await listProducts({ includeInactive: true });
    const existingSkus = new Set(existing.map((p) => p.sku));
    const existingById = new Map(existing.map((p) => [p.sku, p]));

    if (type === "product") {
      const report = validateProductImport(rows, existingSkus);
      if (report.duplicateSkus.length) {
        return { error: `Resolve ${report.duplicateSkus.length} duplicate SKU(s) before applying.` };
      }
      for (const row of rows) {
        const sku     = row.DocTitle?.trim();
        if (!sku) continue;
        const values  = productRowToValues(row);
        const existing = existingById.get(sku);
        if (existing) {
          await updateProduct(existing.id, values as Parameters<typeof updateProduct>[1]);
        } else {
          await createProduct(values as Parameters<typeof createProduct>[0]);
        }
      }
    } else {
      const allMaterials = await listMaterials();
      const glossMat = allMaterials.find((m) => m.code === "Gloss");
      const matteMat = allMaterials.find((m) => m.code === "Matte");

      if (!glossMat || !matteMat) {
        return { error: "Gloss and Matte materials are not seeded. Run the catalog migration first." };
      }

      const report = validatePricingImport(rows, existingSkus);
      if (report.duplicateSkus.length || report.invalidPrices.length || report.unmatched.length) {
        return {
          error: `Resolve ${report.duplicateSkus.length + report.invalidPrices.length + report.unmatched.length} issue(s) before applying.`,
        };
      }

      for (const row of rows) {
        const sku = row.SKU?.trim();
        if (!sku) continue;
        const product = existingById.get(sku);
        if (!product) continue;

        const effectiveDate = row.EffectiveDate || new Date().toISOString().slice(0, 10);
        const revision      = row.PriceListRevision || null;

        const gloss = parseFloat(row.GlossPrice);
        const matte = parseFloat(row.MattePrice);

        if (Number.isFinite(gloss) && gloss > 0) {
          await upsertPrice(product.id, glossMat.id, gloss.toFixed(2), effectiveDate, revision);
        }
        if (Number.isFinite(matte) && matte > 0) {
          await upsertPrice(product.id, matteMat.id, matte.toFixed(2), effectiveDate, revision);
        }

        // Update product metadata from pricing row.
        await updateProduct(product.id, {
          includedPieces: row.IncludedPieces || null,
          priceListRevision: revision,
          priceEffectiveDate: effectiveDate,
        });
      }
    }

    revalidatePath("/catalog");
    revalidatePath("/settings/catalog");
    return { applied: true, report: { rows: rows.length, source: sourceName || `${type}.csv` } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Import failed." };
  }
}
