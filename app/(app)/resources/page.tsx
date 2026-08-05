import { requireUser } from "@/lib/auth";

export const metadata = { title: "Resources — Ordering Hub" };

export default async function ResourcesPage() {
  await requireUser();

  return (
    <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
      Resource library arrives in Phase 6.
    </p>
  );
}
