import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { listWorkOrders, type WorkOrderTab } from "@/lib/production/service";
import { ProductionQueue } from "@/components/production/production-queue";

export const metadata = { title: "Production Queue — Ordering Hub" };

const PAGE_SIZE = 25;

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!can(user, "production:view")) redirect("/dashboard");

  const tab  = (params.tab ?? "current") as WorkOrderTab;
  const page = Math.max(1, Number(params.page) || 1);
  const { workOrders, total } = await listWorkOrders(user, tab, { page, pageSize: PAGE_SIZE });

  return (
    <ProductionQueue
      workOrders={workOrders}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      activeTab={tab}
      canManage={can(user, "production:manage")}
      canQC={can(user, "order:qc")}
      canClaim={can(user, "order:claim")}
      canPrint={can(user, "order:print_labels")}
    />
  );
}
