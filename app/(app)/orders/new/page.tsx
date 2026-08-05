import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";

export const metadata = { title: "New Order — Ordering Hub" };

export default async function NewOrderPage() {
  const user = await requireUser();
  if (!can(user, "order:create")) redirect("/orders");

  return (
    <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
      New Order builder arrives in Phase 3.
    </p>
  );
}
