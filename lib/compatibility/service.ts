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
