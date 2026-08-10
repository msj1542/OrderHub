import { requireUser }   from "@/lib/auth";
import { can }           from "@/lib/authz/policy";
import { redirect }      from "next/navigation";
import { listProducts }  from "@/lib/catalog/service";
import { listMaterials } from "@/lib/catalog/service";
import { listVehicleModels, listAllProductVehicleModelIds } from "@/lib/compatibility/service";
import { getSettings } from "@/lib/settings/schedule";
import { CatalogManager } from "@/components/catalog/catalog-manager";

export const metadata = { title: "Catalog Settings — Ordering Hub" };

export default async function CatalogSettingsPage() {
  const user = await requireUser();
  if (!can(user, "catalog:manage")) redirect("/dashboard");

  const [{ products }, materials, vehicleModels, fitmentsByProduct, settings] = await Promise.all([
    listProducts({ includeInactive: true }),
    listMaterials(),
    listVehicleModels(),
    listAllProductVehicleModelIds(),
    getSettings(),
  ]);

  return (
    <CatalogManager
      products={products}
      materials={materials}
      vehicleModels={vehicleModels}
      fitmentsByProduct={fitmentsByProduct}
      canImport={can(user, "catalog:manage")}
      businessTimezone={settings.businessTimezone}
    />
  );
}
