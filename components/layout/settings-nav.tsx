"use client";

import Link       from "next/link";
import { usePathname } from "next/navigation";
import { can }    from "@/lib/authz/policy";
import type { AppUser } from "@/lib/db/schema";

const SETTINGS_TABS = [
  { label: "Companies",  href: "/settings/companies",  action: "companies:manage" as const },
  { label: "Team",       href: "/settings/team",       action: "users:manage_internal" as const },
  { label: "Catalog",    href: "/settings/catalog",    action: "catalog:manage" as const },
  { label: "Materials",  href: "/settings/materials",  action: "materials:manage" as const },
  { label: "Resources",  href: "/settings/resources",  action: "resources:manage" as const },
  { label: "Operations", href: "/settings/operations", action: "settings:manage" as const },
  { label: "Audit",      href: "/settings/audit",      action: "settings:manage" as const },
];

export function SettingsNav({ user }: { user: AppUser }) {
  const pathname = usePathname();

  const tabs = SETTINGS_TABS.filter((t) => can(user, t.action));

  return (
    <nav
      role="tablist"
      aria-label="Settings sections"
      style={{
        display:    "flex",
        gap:        "var(--space-1)",
        borderBottom: "1px solid var(--color-border-default)",
        marginBottom: "var(--space-4)",
      }}
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            style={{
              padding:      "var(--space-2) var(--space-4)",
              fontSize:     "var(--text-sm)",
              fontWeight:   active ? "var(--weight-semibold)" : "var(--weight-regular)",
              color:        active ? "var(--color-brand)" : "var(--color-text-muted)",
              borderBottom: active ? "2px solid var(--color-brand)" : "2px solid transparent",
              marginBottom: -1,
              textDecoration: "none",
              whiteSpace:   "nowrap",
              transition:   "color 0.1s, border-color 0.1s",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
