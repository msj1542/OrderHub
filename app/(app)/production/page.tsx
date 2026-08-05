import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";

export const metadata = { title: "Production Queue — Ordering Hub" };

export default async function ProductionPage() {
  const user = await requireUser();
  if (!can(user, "production:view")) redirect("/dashboard");

  return (
    <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
      Production queue arrives in Phase 4.
    </p>
  );
}
