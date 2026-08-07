import { requireUser, getPreviewContext } from "@/lib/auth";
import { exitPreviewAction, signOutAction } from "./actions";
import { Sidebar }       from "@/components/layout/sidebar";
import { Topbar }        from "@/components/layout/topbar";
import { PreviewBanner } from "@/components/layout/preview-banner";
import { getUnreadCount } from "@/lib/notifications/service";
import { getSidebarBadges } from "@/lib/orders/service";
import { isInternal as isInternalRole } from "@/lib/authz/roles";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  const [unreadCount, sidebarBadges] = await Promise.all([getUnreadCount(user), getSidebarBadges(user)]);

  // Preview mode: render the sidebar with the preview user's role so nav
  // reflects what the previewed user would see, but the actual user record
  // (for identity / mutation authz) is the real one.
  const sidebarUser = preview
    ? {
        ...user,
        roleCode: preview.roleCode,
        companyId: preview.companyId,
        role: {
          ...user.role,
          isInternal: isInternalRole(preview.roleCode),
          roleCode:    preview.roleCode,
          displayName: preview.roleCode,
        },
        company: preview
          ? { ...user.company, id: preview.companyId, name: preview.companyName } as typeof user.company
          : user.company,
      }
    : user;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <Sidebar
        user={sidebarUser as typeof user}
        signOutAction={signOutAction}
        badges={sidebarBadges}
        previewBanner={
          preview ? (
            <PreviewBanner preview={preview} exitAction={exitPreviewAction} />
          ) : undefined
        }
      />

      {/* Main area */}
      <div
        style={{
          marginLeft:    "var(--sidebar-w)",
          flex:          1,
          display:       "flex",
          flexDirection: "column",
          minWidth:      0,
        }}
      >
        <Topbar user={user} unreadCount={unreadCount} signOutAction={signOutAction} />

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
