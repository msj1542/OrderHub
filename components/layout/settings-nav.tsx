"use client";

import { useEffect, useRef, useState } from "react";
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
  const scrollRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [fade, setFade] = useState({ left: false, right: false });

  const tabs = user.role.isInternal
    ? SETTINGS_TABS.filter((t) => can(user, t.action))
    : EXTERNAL_SETTINGS_TABS;

  function updateFade() {
    const el = scrollRef.current;
    if (!el) return;
    setFade({
      left:  el.scrollLeft > 2,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 2,
    });
  }

  // Land directly on a scrolled-off tab (e.g. a deep link to Audit on a
  // narrow viewport) and it's still selected but invisible unless brought
  // into view — scroll-to-clip alone doesn't handle that.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    updateFade();
  }, [pathname]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFade();
    el.addEventListener("scroll", updateFade, { passive: true });
    window.addEventListener("resize", updateFade);
    return () => {
      el.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", updateFade);
    };
  }, [tabs.length]);

  return (
    <div style={{ position: "relative" }}>
      <nav
        ref={scrollRef}
        role="tablist"
        aria-label="Settings sections"
        style={{
          display:      "flex",
          gap:          "var(--space-1)",
          borderBottom: "1px solid var(--color-border-default)",
          marginBottom: "var(--space-4)",
          overflowX:    "auto",
          scrollSnapType: "x proximity",
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
              ref={active ? activeRef : undefined}
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
                scrollSnapAlign: "start",
                transition:   "color 0.1s, border-color 0.1s",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Edge fades hint there's more to scroll to — a bare overflow-x
          scroll area with no affordance reads as "the layout is broken"
          rather than "swipe for more," especially before the user's first
          touch. Tracks real scroll position rather than always showing. */}
      {fade.left && (
        <div
          aria-hidden
          style={{
            position: "absolute", left: 0, top: 0, bottom: "var(--space-4)", width: 24,
            background: "linear-gradient(to right, var(--color-canvas), transparent)",
            pointerEvents: "none",
          }}
        />
      )}
      {fade.right && (
        <div
          aria-hidden
          style={{
            position: "absolute", right: 0, top: 0, bottom: "var(--space-4)", width: 24,
            background: "linear-gradient(to left, var(--color-canvas), transparent)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
