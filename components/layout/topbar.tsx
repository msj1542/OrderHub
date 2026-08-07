"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Settings } from "lucide-react";
import Link            from "next/link";
import type { AppUser } from "@/lib/db/schema";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { can }         from "@/lib/authz/policy";

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard":     "Dashboard",
  "/orders":        "Orders",
  "/orders/new":    "New Order",
  "/production":    "Production Queue",
  "/catalog":       "Product Catalog",
  "/resources":     "Resources",
  "/notifications": "Notifications",
  "/company-users": "Team",
  "/settings":      "Settings",
};

function pageTitle(pathname: string): string {
  if (pathname === "/") return "Ordering Hub";
  // Exact match first, then prefix.
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  const prefix = Object.keys(ROUTE_TITLES)
    .filter((k) => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? ROUTE_TITLES[prefix] : "Ordering Hub";
}

interface TopbarProps {
  user: AppUser;
  unreadCount?: number;
  signOutAction: () => Promise<void>;
}

export function Topbar({ user, unreadCount: initialUnreadCount = 0, signOutAction }: TopbarProps) {
  const pathname = usePathname();
  const title    = pageTitle(pathname);

  // Server gives us the count as of the last render; a live Realtime
  // subscription increments it in between navigations. RLS on `notifications`
  // (see supabase/migrations/0006_phase6.sql) is what actually scopes which
  // inserts this client receives — not this component.
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);

  React.useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notifications-count")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => setUnreadCount((c) => c + 1),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <header
      style={{
        position:    "sticky",
        top:         0,
        height:      "var(--topbar-h)",
        background:  "var(--color-panel)",
        borderBottom: "1px solid var(--color-border-default)",
        display:     "flex",
        alignItems:  "center",
        padding:     "0 var(--space-6)",
        gap:         "var(--space-4)",
        zIndex:      30,
      }}
    >
      {/* Page title */}
      <h1
        style={{
          flex:       1,
          fontSize:   "var(--text-md)",
          fontWeight: "var(--weight-semibold)",
          color:      "var(--color-text-primary)",
          margin:     0,
        }}
      >
        {title}
      </h1>

      {/* Dark mode toggle */}
      <ThemeToggle />

      {/* Notifications */}
      <Link
        href="/notifications"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        style={{
          position:   "relative",
          display:    "flex",
          alignItems: "center",
          justifyContent: "center",
          width:      32,
          height:     32,
          borderRadius: "var(--radius-md)",
          color:      "var(--color-text-muted)",
          textDecoration: "none",
        }}
        className="hover:bg-[var(--color-sunken)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span
            aria-hidden
            style={{
              position:   "absolute",
              top:        3,
              right:      3,
              width:      8,
              height:     8,
              borderRadius: "var(--radius-pill)",
              background: "var(--color-brand)",
              border:     "2px solid var(--color-panel)",
            }}
          />
        )}
      </Link>

      {/* User avatar/initials with dropdown */}
      <AvatarMenu user={user} signOutAction={signOutAction} />
    </header>
  );
}

function AvatarMenu({ user, signOutAction }: { user: AppUser; signOutAction: () => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`${user.name} · ${user.role.displayName}`}
        style={{
          width:          32,
          height:         32,
          borderRadius:   "var(--radius-pill)",
          background:     "var(--color-brand-subtle)",
          color:          "var(--color-brand)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       "var(--text-xs)",
          fontWeight:     "var(--weight-semibold)",
          userSelect:     "none",
          cursor:         "pointer",
          border:         "none",
        }}
      >
        {initials}
      </button>

      {open && (
        <div
          style={{
            position:     "absolute",
            top:          "calc(100% + var(--space-2))",
            right:        0,
            minWidth:     200,
            background:   "var(--color-panel)",
            border:       "1px solid var(--color-border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow:    "var(--shadow-md)",
            zIndex:       50,
            overflow:     "hidden",
          }}
        >
          <div style={{ padding: "var(--space-4) var(--space-4) var(--space-3)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-text-primary)" }}>
              {user.name}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
              {user.role.displayName}
              {user.company ? ` · ${user.company.name}` : ""}
            </div>
          </div>

          {can(user, "settings:manage") && (
            <Link
              href="/settings/companies"
              onClick={() => setOpen(false)}
              style={{
                display:        "flex",
                alignItems:     "center",
                gap:            "var(--space-3)",
                padding:        "var(--space-3) var(--space-4)",
                fontSize:       "var(--text-sm)",
                color:          "var(--color-text-primary)",
                textDecoration: "none",
              }}
              className="hover:bg-[var(--color-sunken)] transition-colors"
            >
              <Settings size={14} strokeWidth={2} />
              Settings
            </Link>
          )}

          <form action={signOutAction}>
            <button
              type="submit"
              onClick={() => setOpen(false)}
              style={{
                display:     "flex",
                alignItems:  "center",
                gap:         "var(--space-3)",
                width:       "100%",
                padding:     "var(--space-3) var(--space-4)",
                fontSize:    "var(--text-sm)",
                color:       "var(--color-text-primary)",
                background:  "transparent",
                border:      "none",
                cursor:      "pointer",
                textAlign:   "left",
              }}
              className="hover:bg-[var(--color-sunken)] transition-colors"
            >
              <LogOut size={14} strokeWidth={2} />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
