import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  materials,
  materialRollWidths,
  products,
  productMaterials,
  prices,
  productFiles,
  type Material,
  type MaterialRollWidth,
  type MaterialWithRolls,
  type NewMaterial,
  type NewMaterialRollWidth,
  type NewProduct,
  type Price,
  type Product,
  type ProductFile,
  type ProductFull,
  type ProductWithMaterials,
} from "@/lib/db/schema";

// ── Materials ─────────────────────────────────────────────────

export async function listMaterials(): Promise<MaterialWithRolls[]> {
  const mats = await db.select().from(materials).orderBy(materials.name);
  const rolls = await db.select().from(materialRollWidths).orderBy(materialRollWidths.widthIn);
  return mats.map((m) => ({
    ...m,
    rolls: rolls.filter((r) => r.materialId === m.id),
  }));
}

export async function getMaterial(id: string): Promise<MaterialWithRolls | null> {
  const [mat] = await db.select().from(materials).where(eq(materials.id, id));
  if (!mat) return null;
  const rolls = await db
    .select()
    .from(materialRollWidths)
    .where(eq(materialRollWidths.materialId, id))
    .orderBy(materialRollWidths.widthIn);
  return { ...mat, rolls };
}

export async function createMaterial(data: NewMaterial): Promise<Material> {
  const [mat] = await db.insert(materials).values(data).returning();
  return mat;
}

export async function updateMaterial(
  id: string,
  data: Partial<Pick<Material, "code" | "name" | "isActive">>,
): Promise<Material> {
  const [mat] = await db
    .update(materials)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(materials.id, id))
    .returning();
  return mat;
}

export async function addRollWidth(data: NewMaterialRollWidth): Promise<MaterialRollWidth> {
  const [roll] = await db.insert(materialRollWidths).values(data).returning();
  return roll;
}

export async function updateRollWidth(
  id: string,
  data: Partial<Pick<MaterialRollWidth, "widthIn" | "lengthFt" | "rollCost" | "handlingCost" | "isActive">>,
): Promise<MaterialRollWidth> {
  const [roll] = await db
    .update(materialRollWidths)
    .set(data)
    .where(eq(materialRollWidths.id, id))
    .returning();
  return roll;
}

// ── Products ──────────────────────────────────────────────────

type ProductFilters = {
  query?: string;
  isActive?: boolean;
  includeInactive?: boolean;
};

export async function listProducts(
  filters: ProductFilters = {},
): Promise<ProductWithMaterials[]> {
  const conditions = [];

  if (!filters.includeInactive) {
    conditions.push(eq(products.isActive, true));
  }

  if (filters.query && filters.query.trim()) {
    const q = `%${filters.query.trim()}%`;
    conditions.push(
      or(
        ilike(products.sku, q),
        ilike(products.brand, q),
        ilike(products.model, q),
        ilike(products.partName, q),
        ilike(products.description, q),
        ilike(products.attr1, q),
        ilike(products.attr2, q),
      ),
    );
  }

  const rows =
    conditions.length > 0
      ? await db.select().from(products).where(and(...conditions)).orderBy(products.sku)
      : await db.select().from(products).orderBy(products.sku);

  return hydrateProducts(rows);
}

export async function getProduct(id: string): Promise<ProductFull | null> {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) return null;

  const hydrated = await hydrateProducts([product]);
  const base = hydrated[0];

  const files = await db
    .select()
    .from(productFiles)
    .where(eq(productFiles.productId, id))
    .orderBy(productFiles.sortOrder);

  return { ...base, files };
}

export async function getProductBySku(sku: string): Promise<Product | null> {
  const [product] = await db.select().from(products).where(eq(products.sku, sku));
  return product ?? null;
}

export async function createProduct(data: NewProduct): Promise<Product> {
  const [product] = await db.insert(products).values(data).returning();
  return product;
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<NewProduct, "id" | "createdAt">>,
): Promise<Product> {
  const [product] = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  return product;
}

export async function setProductMaterials(
  productId: string,
  materialIds: string[],
): Promise<void> {
  await db.delete(productMaterials).where(eq(productMaterials.productId, productId));
  if (materialIds.length > 0) {
    await db
      .insert(productMaterials)
      .values(materialIds.map((materialId) => ({ productId, materialId })));
  }
}

export async function upsertPrice(
  productId: string,
  materialId: string,
  unitPrice: string,
  effectiveDate: string,
  revision: string | null,
): Promise<void> {
  // Deactivate existing prices for this product+material combination.
  await db
    .update(prices)
    .set({ isActive: false })
    .where(
      and(eq(prices.productId, productId), eq(prices.materialId, materialId), eq(prices.isActive, true)),
    );

  await db.insert(prices).values({
    productId,
    materialId,
    unitPrice,
    effectiveDate,
    revision,
    isActive: true,
  });
}

export async function addProductFile(data: {
  productId: string;
  label: string;
  filePath: string;
  mimeType?: string;
  isThumbnail?: boolean;
}): Promise<ProductFile> {
  if (data.isThumbnail) {
    // Clear the thumbnail flag from other files for this product.
    await db
      .update(productFiles)
      .set({ isThumbnail: false })
      .where(and(eq(productFiles.productId, data.productId), eq(productFiles.isThumbnail, true)));

    // Also clear thumbnail_path from product if replacing.
    await db
      .update(products)
      .set({ thumbnailPath: data.filePath, updatedAt: new Date() })
      .where(eq(products.id, data.productId));
  }

  const [file] = await db
    .insert(productFiles)
    .values({
      productId: data.productId,
      label: data.label,
      filePath: data.filePath,
      mimeType: data.mimeType,
      isThumbnail: data.isThumbnail ?? false,
    })
    .returning();
  return file;
}

export async function setProductThumbnail(productId: string, fileId: string): Promise<void> {
  await db
    .update(productFiles)
    .set({ isThumbnail: false })
    .where(eq(productFiles.productId, productId));

  const [file] = await db
    .update(productFiles)
    .set({ isThumbnail: true })
    .where(and(eq(productFiles.id, fileId), eq(productFiles.productId, productId)))
    .returning();

  if (file) {
    await db
      .update(products)
      .set({ thumbnailPath: file.filePath, updatedAt: new Date() })
      .where(eq(products.id, productId));
  }
}

// ── Internal helpers ──────────────────────────────────────────

async function hydrateProducts(rows: Product[]): Promise<ProductWithMaterials[]> {
  if (rows.length === 0) return [];

  const [allCompat, allMaterials, allRolls, activePrices] = await Promise.all([
    db.select().from(productMaterials),
    db.select().from(materials),
    db.select().from(materialRollWidths).orderBy(materialRollWidths.widthIn),
    db.select().from(prices).where(eq(prices.isActive, true)),
  ]);

  const productIds = new Set(rows.map((p) => p.id));
  const materialsById = new Map(allMaterials.map((m) => [m.id, m]));

  return rows.map((product) => {
    const compatMaterialIds = allCompat
      .filter((c) => productIds.has(c.productId) && c.productId === product.id)
      .map((c) => c.materialId);

    const productMats = compatMaterialIds
      .map((mid) => materialsById.get(mid))
      .filter((m): m is Material => m != null)
      .map((m) => ({
        ...m,
        rolls: allRolls.filter((r) => r.materialId === m.id),
      }));

    const productPrices = activePrices
      .filter((p) => p.productId === product.id)
      .map((p) => ({
        ...p,
        material: materialsById.get(p.materialId)!,
      }))
      .filter((p) => p.material != null);

    return { ...product, materials: productMats, prices: productPrices };
  });
}
