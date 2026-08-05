import { requireUser } from "@/lib/auth";

export const metadata = { title: "Product Catalog — Ordering Hub" };

export default async function CatalogPage() {
  await requireUser();

  return (
    <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
      Product catalog arrives in Phase 2.
    </p>
  );
}
