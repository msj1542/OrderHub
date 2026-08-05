import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";

export const metadata = { title: "Team — Ordering Hub" };

export default async function CompanyUsersPage() {
  const user = await requireUser();
  if (!can(user, "users:manage_external") || user.role.isInternal) {
    redirect("/dashboard");
  }

  return (
    <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
      Team management arrives in Phase 6.
    </p>
  );
}
