import { requireUser }   from "@/lib/auth";
import { can }           from "@/lib/authz/policy";
import { redirect }      from "next/navigation";
import { listProducts }  from "@/lib/catalog/service";
import { listMaterials } from "@/lib/catalog/service";
import { CatalogBrowse } from "@/components/catalog/catalog-browse";

export const metadata = { title: "Product Catalog — Ordering Hub" };

export default async function CatalogPage() {
  const user = await requireUser();
  if (!can(user, "catalog:view")) redirect("/dashboard");

  const [products, materials] = await Promise.all([
    listProducts({
      includeInactive:    user.role.isInternal,
      customerVisibleOnly: !user.role.isInternal,
    }),
    listMaterials(),
  ]);

  const pricingVisible = can(user, "pricing:view");

  return (
    <CatalogBrowse
      products={products}
      materials={materials}
      pricingVisible={pricingVisible}
    />
  );
}
