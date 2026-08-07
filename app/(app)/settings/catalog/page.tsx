import { requireUser }   from "@/lib/auth";
import { can }           from "@/lib/authz/policy";
import { redirect }      from "next/navigation";
import { listProducts }  from "@/lib/catalog/service";
import { listMaterials } from "@/lib/catalog/service";
import { CatalogManager } from "@/components/catalog/catalog-manager";

export const metadata = { title: "Catalog Settings — Ordering Hub" };

export default async function CatalogSettingsPage() {
  const user = await requireUser();
  if (!can(user, "catalog:manage")) redirect("/dashboard");

  const [{ products }, materials] = await Promise.all([
    listProducts({ includeInactive: true }),
    listMaterials(),
  ]);

  return (
    <CatalogManager
      products={products}
      materials={materials}
      canImport={can(user, "catalog:manage")}
    />
  );
}
