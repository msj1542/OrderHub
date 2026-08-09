import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { SettingsNav } from "@/components/layout/settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isExternalCompanyAdmin = !user.role.isInternal && can(user, "users:manage_external");
  if (!can(user, "settings:manage") && !isExternalCompanyAdmin) redirect("/dashboard");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <SettingsNav user={user} />
      {children}
    </div>
  );
}
