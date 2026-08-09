import { requireUser, getPreviewContext } from "@/lib/auth";
import { exitPreviewAction, signOutAction } from "./actions";
import { AppShell }      from "@/components/layout/app-shell";
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
    <AppShell
      sidebarUser={sidebarUser as typeof user}
      topbarUser={user}
      signOutAction={signOutAction}
      badges={sidebarBadges}
      unreadCount={unreadCount}
      previewBanner={
        preview ? (
          <PreviewBanner preview={preview} exitAction={exitPreviewAction} />
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}
