"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar }  from "@/components/layout/topbar";
import type { AppUser } from "@/lib/db/schema";

interface AppShellProps {
  sidebarUser:    AppUser;
  topbarUser:     AppUser;
  signOutAction:  () => Promise<void>;
  previewBanner?: React.ReactNode;
  badges?:        { orders?: number; production?: number };
  unreadCount:    number;
  children:       React.ReactNode;
}

/**
 * Holds the mobile nav-drawer open/closed state shared between Sidebar and
 * Topbar (siblings rendered from the server layout, so a lifted client
 * component is the simplest way to coordinate them without a context).
 */
export function AppShell({
  sidebarUser,
  topbarUser,
  signOutAction,
  previewBanner,
  badges,
  unreadCount,
  children,
}: AppShellProps) {
  const [navOpen, setNavOpen] = React.useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (covers taps that don't go
  // through Sidebar's own onClick handlers, e.g. browser back/forward).
  // Adjusted during render rather than in an effect — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-when-a-prop-changes.
  const [prevPathname, setPrevPathname] = React.useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setNavOpen(false);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        user={sidebarUser}
        signOutAction={signOutAction}
        badges={badges}
        previewBanner={previewBanner}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div
        className="md:ml-[var(--sidebar-w)]"
        style={{
          flex:          1,
          display:       "flex",
          flexDirection: "column",
          minWidth:      0,
        }}
      >
        <Topbar
          user={topbarUser}
          unreadCount={unreadCount}
          signOutAction={signOutAction}
          onMenuClick={() => setNavOpen(true)}
        />

        <main
          style={{
            flex:       1,
            padding:    "var(--space-6)",
            background: "var(--color-canvas)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
