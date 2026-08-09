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

// External company admins get a much smaller Settings area — their own
// company's details plus the Team page (relocated here from its old
// standalone sidebar link), mirroring how internal users have Team under
// internal Settings.
const EXTERNAL_SETTINGS_TABS = [
  { label: "Company", href: "/settings/company" },
  { label: "Team",    href: "/company-users" },
];

export function SettingsNav({ user }: { user: AppUser }) {
  const pathname = usePathname();

  const tabs = user.role.isInternal
    ? SETTINGS_TABS.filter((t) => can(user, t.action))
    : EXTERNAL_SETTINGS_TABS;

  return (
    <nav
      role="tablist"
      aria-label="Settings sections"
      style={{
        display:    "flex",
        gap:        "var(--space-1)",
        borderBottom: "1px solid var(--color-border-default)",
        marginBottom: "var(--space-4)",
        overflowX:  "auto",
        // Narrow viewports can't fit every tab (7 for internal admins) —
        // scroll horizontally instead of clipping the overflow, matching
        // how DataTable handles the same problem elsewhere in the app.
        WebkitOverflowScrolling: "touch",
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
              flexShrink:   0,
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
