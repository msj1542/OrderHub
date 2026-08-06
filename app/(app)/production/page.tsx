import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { listWorkOrders, type WorkOrderTab } from "@/lib/production/service";
import { ProductionQueue } from "@/components/production/production-queue";

export const metadata = { title: "Production Queue — Ordering Hub" };

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!can(user, "production:view")) redirect("/dashboard");

  const tab = (params.tab ?? "current") as WorkOrderTab;
  const workOrders = await listWorkOrders(user, tab);

  return (
    <ProductionQueue
      workOrders={workOrders}
      activeTab={tab}
      canManage={can(user, "production:manage")}
      canQC={can(user, "order:qc")}
      canClaim={can(user, "order:claim")}
      canPrint={can(user, "order:print_labels")}
    />
  );
}
