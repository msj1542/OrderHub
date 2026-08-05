import { requireUser } from "@/lib/auth";

export const metadata = { title: "Notifications — Ordering Hub" };

export default async function NotificationsPage() {
  await requireUser();

  return (
    <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
      Notifications arrive in Phase 6.
    </p>
  );
}
