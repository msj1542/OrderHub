import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { redirect } from "next/navigation";
import { listMaterials, listProducts } from "@/lib/catalog/service";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { NewOrder } from "@/components/orders/new-order";

export const metadata = { title: "New Order — Ordering Hub" };

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ supplemental_to?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "order:create")) redirect("/orders");

  const params = await searchParams;
  const supplementalToOrderId = params.supplemental_to;

  const [products, materialsData, allCompanies] = await Promise.all([
    listProducts({ includeInactive: false, customerVisibleOnly: !user.role.isInternal }),
    listMaterials(),
    user.role.isInternal
      ? db.select().from(companies).orderBy(asc(companies.name))
      : Promise.resolve([]),
  ]);

  return (
    <NewOrder
      products={products}
      materials={materialsData}
      companies={allCompanies}
      isInternal={user.role.isInternal}
      supplementalToOrderId={supplementalToOrderId}
      defaultCompanyId={user.companyId ?? undefined}
    />
  );
}
