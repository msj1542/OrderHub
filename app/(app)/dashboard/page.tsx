import { requireUser } from "@/lib/auth";

export const metadata = { title: "Dashboard — Ordering Hub" };

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div>
      <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
        Welcome back, {user.name}. Dashboard content arrives in Phase 3.
      </p>
    </div>
  );
}
