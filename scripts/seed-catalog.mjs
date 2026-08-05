/**
 * Seed the product catalog and pricing data from the reference CSV files.
 *
 * Safe to re-run — products are upserted by SKU; prices are replaced if a
 * matching active price already exists.
 *
 * Run: node --env-file=.env.local scripts/seed-catalog.mjs
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });

// ── CSV parser (same logic as lib/catalog/csv.ts) ─────────────

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; }
      else { field += char; }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field); field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }

  const header = rows.shift()?.map((v) => v.replace(/^﻿/, "")) ?? [];
  return rows
    .filter((values) => values.some(Boolean))
    .map((values) => Object.fromEntries(header.map((key, i) => [key, values[i] ?? ""])));
}

// ── Load CSVs ─────────────────────────────────────────────────

const refBase = resolve(root, "../../Codex/2026-07-29/ordering-hub-sites-project-appgprj-6a6a8e869e3081918c3c61a26d78c2d8-2/work/site/data");

let productRows, pricingRows;
try {
  productRows = parseCsv(readFileSync(resolve(refBase, "product-catalog.csv"), "utf-8"));
  pricingRows = parseCsv(readFileSync(resolve(refBase, "price-catalog.csv"), "utf-8"));
} catch {
  // Fall back to local copies if present.
  productRows = parseCsv(readFileSync(resolve(root, "data/product-catalog.csv"), "utf-8"));
  pricingRows = parseCsv(readFileSync(resolve(root, "data/price-catalog.csv"), "utf-8"));
}

const pricingBySku = new Map(pricingRows.map((r) => [r.SKU.trim(), r]));

// ── Fetch material IDs ────────────────────────────────────────

const materials = await sql`SELECT id, code FROM public.materials WHERE code IN ('Gloss', 'Matte')`;
const glossMat = materials.find((m) => m.code === "Gloss");
const matteMat = materials.find((m) => m.code === "Matte");

if (!glossMat || !matteMat) {
  console.error("❌  Materials not found — run the Phase 2 migration first.");
  await sql.end();
  process.exit(1);
}

console.log(`📦  Seeding ${productRows.length} products...`);

let inserted = 0;
let updated = 0;
let priceRows = 0;

for (const row of productRows) {
  const sku = row.DocTitle?.trim();
  if (!sku) continue;

  const pricing = pricingBySku.get(sku);

  const description = (pricing?.ProductDescription || row.Description || sku).trim();
  const includedPieces = pricing?.IncludedPieces || null;
  const isActive = pricing ? pricing.Active?.toUpperCase() === "TRUE" : true;

  const patternLengthIn = row.Width ? parseFloat(row.Width).toFixed(4) : null;
  const requiredRollWidthIn = row.Height ? parseFloat(row.Height).toFixed(4) : null;

  // Upsert the product by SKU.
  const [existing] = await sql`SELECT id FROM public.products WHERE sku = ${sku}`;

  let productId;
  if (existing) {
    await sql`
      UPDATE public.products SET
        brand = ${row.BrandName || "Unknown"},
        model = ${row.ModelName || "Generic"},
        year_start = ${row.StartYear || null},
        part_name = ${row.PartName || "Kit"},
        attr1 = ${row.Attr1 || null},
        attr2 = ${row.Attr2 || null},
        description = ${description},
        included_pieces = ${includedPieces},
        version = ${row.Version || null},
        pattern_length_in = ${patternLengthIn},
        required_roll_width_in = ${requiredRollWidthIn},
        source_reference = ${row.SourceFile || null},
        price_list_revision = ${pricing?.PriceListRevision || null},
        price_effective_date = ${pricing?.EffectiveDate || null},
        is_active = ${isActive},
        updated_at = now()
      WHERE sku = ${sku}
    `;
    productId = existing.id;
    updated++;
  } else {
    const [newProduct] = await sql`
      INSERT INTO public.products (
        sku, brand, model, year_start, part_name, attr1, attr2,
        description, included_pieces, version,
        pattern_length_in, required_roll_width_in,
        source_reference, price_list_revision, price_effective_date, is_active
      ) VALUES (
        ${sku}, ${row.BrandName || "Unknown"}, ${row.ModelName || "Generic"},
        ${row.StartYear || null}, ${row.PartName || "Kit"},
        ${row.Attr1 || null}, ${row.Attr2 || null},
        ${description}, ${includedPieces}, ${row.Version || null},
        ${patternLengthIn}, ${requiredRollWidthIn},
        ${row.SourceFile || null}, ${pricing?.PriceListRevision || null},
        ${pricing?.EffectiveDate || null}, ${isActive}
      ) RETURNING id
    `;
    productId = newProduct.id;
    inserted++;
  }

  // Seed product_materials for both Gloss and Matte.
  for (const matId of [glossMat.id, matteMat.id]) {
    await sql`
      INSERT INTO public.product_materials (product_id, material_id)
      VALUES (${productId}, ${matId})
      ON CONFLICT DO NOTHING
    `;
  }

  // Seed prices if available and valid.
  if (pricing) {
    const glossPrice = parseFloat(pricing.GlossPrice);
    const mattePrice = parseFloat(pricing.MattePrice);
    const effectiveDate = pricing.EffectiveDate;
    const revision = pricing.PriceListRevision;

    if (Number.isFinite(glossPrice) && glossPrice > 0) {
      await sql`UPDATE public.prices SET is_active = false WHERE product_id = ${productId} AND material_id = ${glossMat.id} AND is_active = true`;
      await sql`
        INSERT INTO public.prices (product_id, material_id, unit_price, effective_date, revision, is_active)
        VALUES (${productId}, ${glossMat.id}, ${glossPrice.toFixed(2)}, ${effectiveDate}, ${revision}, true)
      `;
      priceRows++;
    }

    if (Number.isFinite(mattePrice) && mattePrice > 0) {
      await sql`UPDATE public.prices SET is_active = false WHERE product_id = ${productId} AND material_id = ${matteMat.id} AND is_active = true`;
      await sql`
        INSERT INTO public.prices (product_id, material_id, unit_price, effective_date, revision, is_active)
        VALUES (${productId}, ${matteMat.id}, ${mattePrice.toFixed(2)}, ${effectiveDate}, ${revision}, true)
      `;
      priceRows++;
    }
  }
}

console.log(`✅  Done: ${inserted} inserted, ${updated} updated, ${priceRows} price rows seeded.`);
await sql.end();
