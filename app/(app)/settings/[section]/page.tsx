import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";

export const metadata = { title: "Settings — Ordering Hub" };

// catalog and materials have dedicated pages under settings/catalog and settings/materials
const VALID_SECTIONS = [
  "companies", "team", "resources", "operations", "audit",
] as const;

type Section = typeof VALID_SECTIONS[number];

type Props = { params: Promise<{ section: string }> };

export default async function SettingsPage({ params }: Props) {
  const user    = await requireUser();
  if (!can(user, "settings:manage")) redirect("/dashboard");

  const { section } = await params;
  if (!VALID_SECTIONS.includes(section as Section)) redirect("/settings/companies");

  return (
    <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
      Settings — {section} — arrives in Phase 6.
    </p>
  );
}
