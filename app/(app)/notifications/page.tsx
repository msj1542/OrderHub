import { requireEffectiveUser } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications/service";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata = { title: "Notifications — Ordering Hub" };

const PAGE_SIZE = 25;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireEffectiveUser();
  const params = await searchParams;
  const page   = Math.max(1, Number(params.page) || 1);

  const { notifications, total } = await listNotifications(user, { page, pageSize: PAGE_SIZE });

  return <NotificationList notifications={notifications} total={total} page={page} pageSize={PAGE_SIZE} />;
}
