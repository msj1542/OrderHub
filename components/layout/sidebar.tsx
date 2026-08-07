"use client";

import Link          from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Wrench,
  Layers,
  FolderOpen,
  Users,
  Bell,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn }         from "@/lib/utils";
import { can }        from "@/lib/authz/policy";
import type { AppUser } from "@/lib/db/schema";

type NavItem = {
  label:  string;
  href:   string;
  icon:   LucideIcon;
  exact?: boolean;
  badge?: number;
};

function buildNav(user: AppUser, badges?: { orders?: number; production?: number }): NavItem[] {
  const items: NavItem[] = [];

  items.push({ label: "Dashboard",   href: "/dashboard", icon: LayoutDashboard, exact: true });

  if (can(user, "order:create") || can(user, "order:accept")) {
    items.push({ label: "Orders", href: "/orders", icon: ClipboardList, badge: badges?.orders });
  }

  if (can(user, "production:view")) {
    items.push({ label: "Production", href: "/production", icon: Wrench, badge: badges?.production });
  }

  if (can(user, "catalog:view")) {
    items.push({ label: "Catalog", href: "/catalog", icon: Layers });
  }

  if (can(user, "resources:download")) {
    items.push({ label: "Resources", href: "/resources", icon: FolderOpen });
  }

  if (can(user, "users:manage_external") && !user.role.isInternal) {
    items.push({ label: "Team", href: "/company-users", icon: Users });
  }

  items.push({ label: "Notifications", href: "/notifications", icon: Bell });

  if (can(user, "settings:manage")) {
    items.push({ label: "Settings", href: "/settings/companies", icon: Settings });
  }

  return items;
}

interface SidebarProps {
  user: AppUser;
  signOutAction: () => Promise<void>;
  previewBanner?: React.ReactNode;
  badges?: { orders?: number; production?: number };
}

export function Sidebar({ user, signOutAction, previewBanner, badges }: SidebarProps) {
  const pathname = usePathname();
  const nav      = buildNav(user, badges);

  return (
    <aside
      style={{
        position:       "fixed",
        inset:          "0 auto 0 0",
        width:          "var(--sidebar-w)",
        background:     "var(--color-panel)",
        borderRight:    "1px solid var(--color-border-default)",
        display:        "flex",
        flexDirection:  "column",
        zIndex:         40,
        overflow:       "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height:        "var(--topbar-h)",
          display:       "flex",
          alignItems:    "center",
          padding:       "0 var(--space-5)",
          borderBottom:  "1px solid var(--color-border-subtle)",
          flexShrink:    0,
        }}
      >
        <Link
          href="/dashboard"
          style={{
            fontSize:     "var(--text-md)",
            fontWeight:   "var(--weight-bold)",
            color:        "var(--color-brand)",
            letterSpacing: "-0.02em",
            textDecoration: "none",
          }}
        >
          Ordering Hub
        </Link>
      </div>

      {/* Preview banner */}
      {previewBanner}

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "var(--space-3) 0" }}>
        {nav.map(({ label, href, icon: Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display:        "flex",
                alignItems:     "center",
                gap:            "var(--space-4)",
                padding:        "var(--space-3) var(--space-5)",
                margin:         "1px var(--space-3)",
                borderRadius:   "var(--radius-md)",
                fontSize:       "var(--text-base)",
                fontWeight:     active ? "var(--weight-semibold)" : "var(--weight-regular)",
                color:          active ? "var(--color-brand)" : "var(--color-text-primary)",
                background:     active ? "var(--color-brand-subtle)" : "transparent",
                textDecoration: "none",
                transition:     "background 0.1s, color 0.1s",
              }}
              className={cn(!active && "hover:bg-[var(--color-sunken)]")}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span style={{ flex: 1 }}>{label}</span>
              {!!badge && badge > 0 && (
                <span
                  style={{
                    minWidth:     18,
                    height:       18,
                    borderRadius: "var(--radius-pill)",
                    background:   "var(--color-brand)",
                    color:        "var(--color-brand-fg)",
                    fontSize:     "var(--text-xs)",
                    fontWeight:   "var(--weight-semibold)",
                    display:      "inline-flex",
                    alignItems:   "center",
                    justifyContent: "center",
                    padding:      "0 5px",
                  }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info + sign-out */}
      <div
        style={{
          padding:    "var(--space-4) var(--space-5)",
          borderTop:  "1px solid var(--color-border-subtle)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            gap:            "var(--space-3)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize:     "var(--text-sm)",
                fontWeight:   "var(--weight-medium)",
                color:        "var(--color-text-primary)",
                overflow:     "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap",
              }}
            >
              {user.name}
            </div>
            <div
              style={{
                fontSize:  "var(--text-xs)",
                color:     "var(--color-text-muted)",
                marginTop: "var(--space-1)",
                overflow:  "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap",
              }}
            >
              {user.role.displayName}
              {user.company ? ` · ${user.company.name}` : ""}
            </div>
          </div>
          <form action={signOutAction} style={{ flexShrink: 0 }}>
            <button
              type="submit"
              title="Sign out"
              style={{
                background:   "transparent",
                border:       "none",
                cursor:       "pointer",
                color:        "var(--color-text-muted)",
                padding:      "var(--space-2)",
                borderRadius: "var(--radius-sm)",
                display:      "flex",
                alignItems:   "center",
              }}
              className="hover:bg-[var(--color-sunken)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <LogOut size={14} strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
