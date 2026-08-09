import { requireEffectiveUser }   from "@/lib/auth";
import { can }           from "@/lib/authz/policy";
import { redirect }      from "next/navigation";
import { listProducts }  from "@/lib/catalog/service";
import { listMaterials } from "@/lib/catalog/service";
import { CatalogBrowse } from "@/components/catalog/catalog-browse";

export const metadata = { title: "Product Catalog — Ordering Hub" };

const PAGE_SIZE = 25;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireEffectiveUser();
  if (!can(user, "catalog:view")) redirect("/dashboard");

  const params = await searchParams;
  const search = params.q ?? "";
  const page   = Math.max(1, Number(params.page) || 1);

  const [{ products, total }, materials] = await Promise.all([
    listProducts({
      includeInactive:     user.role.isInternal,
      customerVisibleOnly: !user.role.isInternal,
      query:                search || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    listMaterials(),
  ]);

  const pricingVisible = can(user, "pricing:view");

  return (
    <CatalogBrowse
      products={products}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      search={search}
      materials={materials}
      pricingVisible={pricingVisible}
    />
  );
}
