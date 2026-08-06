import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications/service";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata = { title: "Notifications — Ordering Hub" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await listNotifications(user);

  return <NotificationList notifications={notifications} />;
}
