"use client";

import * as React     from "react";
import Link          from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Wrench,
  Layers,
  Bike,
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

// ── Desktop breakpoint (useSyncExternalStore source) ────────────

function subscribeToDesktopMq(callback: () => void) {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getDesktopMqSnapshot() {
  return window.matchMedia("(min-width: 768px)").matches;
}

type NavItem = {
  label:  string;
  href:   string;
  icon:   LucideIcon;
  exact?: boolean;
  badge?: number;
  /** Extra path prefixes that should also count as "active" for this item
   *  (e.g. external Team lives at /company-users, outside /settings). */
  activePrefixes?: string[];
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
    items.push({ label: "Compatibility", href: "/compatibility", icon: Bike });
  }

  if (can(user, "resources:download")) {
    items.push({ label: "Resources", href: "/resources", icon: FolderOpen });
  }

  items.push({ label: "Notifications", href: "/notifications", icon: Bell });

  if (can(user, "settings:manage")) {
    items.push({ label: "Settings", href: "/settings/companies", icon: Settings });
  } else if (can(user, "users:manage_external") && !user.role.isInternal) {
    // Company admins reach Team via Settings (Company/Team tabs) instead of
    // a standalone sidebar link, matching how internal Team lives under
    // internal Settings. Team itself still lives at /company-users, so it
    // needs to count as "active" here too even though it's outside /settings.
    items.push({ label: "Settings", href: "/settings/company", icon: Settings, activePrefixes: ["/settings", "/company-users"] });
  }

  return items;
}

interface SidebarProps {
  user: AppUser;
  signOutAction: () => Promise<void>;
  previewBanner?: React.ReactNode;
  badges?: { orders?: number; production?: number };
  /** Mobile drawer state — ignored at the md+ breakpoint, where the sidebar
   *  is always visible (see the md:translate-x-0 override below). */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ user, signOutAction, previewBanner, badges, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const nav      = buildNav(user, badges);

  // The drawer's visibility is resolved in JS (matchMedia) rather than via a
  // CSS breakpoint class, so it composes with the click-driven `open` state
  // through one single source of truth instead of two independent
  // mechanisms fighting over the same transform. useSyncExternalStore (not
  // useState+useEffect) is the API React recommends for subscribing to
  // external mutable state like a MediaQueryList — it also naturally
  // supplies the pre-hydration server snapshot (false/closed), avoiding an
  // extra effect-driven render.
  const isDesktop = React.useSyncExternalStore(subscribeToDesktopMq, getDesktopMqSnapshot, () => false);

  const visible = isDesktop || !!open;

  return (
    <>
      {/* Mobile backdrop — only ever rendered/visible below md, and only while open */}
      {open && !isDesktop && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}
      <aside
        className="fixed inset-y-0 left-0 z-50"
        style={{
          transform:      visible ? "translateX(0)" : "translateX(-100%)",
          transition:     "transform 0.2s ease",
          width:          "var(--sidebar-w)",
          background:     "var(--color-panel)",
          borderRight:    "1px solid var(--color-border-default)",
          display:        "flex",
          flexDirection:  "column",
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
          onClick={onClose}
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
        {nav.map(({ label, href, icon: Icon, exact, badge, activePrefixes }) => {
          const active = exact
            ? pathname === href
            : (activePrefixes ?? [href]).some((p) => pathname.startsWith(p));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
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
    </>
  );
}
