import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";

export const metadata = { title: "Orders — Ordering Hub" };

export default async function OrdersPage() {
  const user = await requireUser();
  if (!can(user, "order:create") && !can(user, "order:accept")) redirect("/dashboard");

  return (
    <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
      Orders workspace arrives in Phase 3.
    </p>
  );
}
