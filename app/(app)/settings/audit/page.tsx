import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { listAuditLog } from "@/lib/audit/service";
import { AuditTimeline } from "@/components/settings/audit-timeline";

export const metadata = { title: "Audit History — Ordering Hub" };

const PAGE_SIZE = 25;

export default async function AuditHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "settings:manage")) redirect("/dashboard");

  const params = await searchParams;
  const page   = Math.max(1, Number(params.page) || 1);

  const { entries, total } = await listAuditLog({ page, pageSize: PAGE_SIZE });

  return <AuditTimeline entries={entries} total={total} page={page} pageSize={PAGE_SIZE} />;
}
