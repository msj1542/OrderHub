import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { redirect } from "next/navigation";
import { listMaterials, listProducts } from "@/lib/catalog/service";
import { getOrder } from "@/lib/orders/service";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { NewOrder } from "@/components/orders/new-order";
import type { Line } from "@/components/orders/new-order";
import type { ProductWithMaterials } from "@/lib/db/schema";

export const metadata = { title: "New Order — Ordering Hub" };

function buildPrefillLines(
  source: Awaited<ReturnType<typeof getOrder>>,
  products: ProductWithMaterials[],
): Line[] {
  if (!source) return [];
  const lines: Line[] = [];
  source.lines.forEach((line, i) => {
    const id = `prefill-${i}`;
    if (line.isCustom) {
      const attrs = line.attributesSnapshot ? JSON.parse(line.attributesSnapshot) : {};
      lines.push({
        id,
        type: "custom",
        description: line.descriptionSnapshot,
        brand: attrs.brand ?? "",
        model: attrs.model ?? "",
        modelYear: attrs.year ?? "",
        coverageArea: attrs.coverageArea ?? "",
        materialId: line.materialId ?? "",
        quantity: line.quantity,
        notes: attrs.notes ?? "",
      });
    } else {
      const product = products.find((p) => p.id === line.productId);
      if (!product) return; // product no longer available — skip on reorder/supplemental
      lines.push({
        id,
        type: "catalog",
        product,
        materialId: line.materialId ?? product.materials[0]?.id ?? "",
        quantity: line.quantity,
      });
    }
  });
  return lines;
}

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ supplemental_to?: string; reorder_from?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "order:create")) redirect("/orders");

  const params = await searchParams;
  const supplementalToOrderId = params.supplemental_to;
  const reorderFromOrderId = params.reorder_from;

  const [{ products }, materialsData, allCompanies] = await Promise.all([
    listProducts({ includeInactive: false, customerVisibleOnly: !user.role.isInternal }),
    listMaterials(),
    user.role.isInternal
      ? db.select().from(companies).orderBy(asc(companies.name))
      : Promise.resolve([]),
  ]);

  let prefillLines: Line[] | undefined;
  let prefillCompanyId: string | undefined;

  const sourceOrderId = reorderFromOrderId || supplementalToOrderId;
  if (sourceOrderId) {
    const source = await getOrder(sourceOrderId, user);
    if (source) {
      prefillLines = buildPrefillLines(source, products);
      prefillCompanyId = source.companyId;
    }
  }

  return (
    <NewOrder
      products={products}
      materials={materialsData}
      companies={allCompanies}
      isInternal={user.role.isInternal}
      supplementalToOrderId={supplementalToOrderId}
      prefillLines={reorderFromOrderId ? prefillLines : undefined}
      defaultCompanyId={prefillCompanyId ?? user.companyId ?? undefined}
    />
  );
}
