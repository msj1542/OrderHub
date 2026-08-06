import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { listAuditLog } from "@/lib/audit/service";
import { AuditTimeline } from "@/components/settings/audit-timeline";

export const metadata = { title: "Audit History — Ordering Hub" };

export default async function AuditHistoryPage() {
  const user = await requireUser();
  if (!can(user, "settings:manage")) redirect("/dashboard");

  const entries = await listAuditLog();

  return <AuditTimeline entries={entries} />;
}
