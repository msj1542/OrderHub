/**
 * Vehicle compatibility matrix — see lib/db/schema.ts (vehicleModels,
 * productVehicleFitments) for why this is separate from products.brand/
 * model/yearStart (a product row holds one representative fitment; the
 * matrix holds the full many-to-many set).
 *
 * Dataset is small (dozens of rows, not thousands) — fetched in full and
 * filtered/grouped client-side in components/compatibility/compatibility-browse.tsx
 * rather than paginated server queries per filter change.
 */

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, vehicleModels, productVehicleFitments, type VehicleModel, type Product } from "@/lib/db/schema";

export async function listVehicleModels(): Promise<VehicleModel[]> {
  return db
    .select()
    .from(vehicleModels)
    .orderBy(asc(vehicleModels.brand), asc(vehicleModels.model), asc(vehicleModels.yearStart));
}

export async function listProductVehicleModelIds(productId: string): Promise<string[]> {
  const rows = await db
    .select({ vehicleModelId: productVehicleFitments.vehicleModelId })
    .from(productVehicleFitments)
    .where(eq(productVehicleFitments.productId, productId));
  return rows.map((r) => r.vehicleModelId);
}

/** Every product's fitment IDs, grouped — for the catalog admin editor (unfiltered by visibility, unlike getCompatibilityData). */
export async function listAllProductVehicleModelIds(): Promise<Record<string, string[]>> {
  const rows = await db
    .select({ productId: productVehicleFitments.productId, vehicleModelId: productVehicleFitments.vehicleModelId })
    .from(productVehicleFitments);
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    (map[r.productId] ??= []).push(r.vehicleModelId);
  }
  return map;
}

export async function createVehicleModel(data: { brand: string; model: string; yearStart?: string | null }): Promise<VehicleModel> {
  const [row] = await db
    .insert(vehicleModels)
    .values({ brand: data.brand.trim(), model: data.model.trim(), yearStart: data.yearStart?.trim() || null })
    .returning();
  return row;
}

/** Replaces a product's full fitment set with exactly `vehicleModelIds` — same replace-in-full pattern as setProductMaterials. */
export async function setProductVehicleFitments(productId: string, vehicleModelIds: string[]): Promise<void> {
  await db.delete(productVehicleFitments).where(eq(productVehicleFitments.productId, productId));
  if (vehicleModelIds.length === 0) return;
  await db.insert(productVehicleFitments).values(
    vehicleModelIds.map((vehicleModelId) => ({ productId, vehicleModelId })),
  );
}

export type CompatibilityFitment = { productId: string; vehicleModelId: string };

export type CompatibilityData = {
  vehicleModels: VehicleModel[];
  products:      Product[];
  fitments:      CompatibilityFitment[];
};

export async function getCompatibilityData(opts: { isInternal: boolean }): Promise<CompatibilityData> {
  const [models, productRows, fitmentRows] = await Promise.all([
    db.select().from(vehicleModels).orderBy(asc(vehicleModels.brand), asc(vehicleModels.model), asc(vehicleModels.yearStart)),
    db
      .select()
      .from(products)
      .where(opts.isInternal ? undefined : and(eq(products.isActive, true), eq(products.customerVisible, true)))
      .orderBy(asc(products.sku)),
    db
      .select({ productId: productVehicleFitments.productId, vehicleModelId: productVehicleFitments.vehicleModelId })
      .from(productVehicleFitments),
  ]);

  const visibleProductIds = new Set(productRows.map((p) => p.id));
  const fitments = fitmentRows.filter((f) => visibleProductIds.has(f.productId));

  return { vehicleModels: models, products: productRows, fitments };
}
