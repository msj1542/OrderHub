"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/(app)/notifications/actions";
import type { NotificationWithReadState } from "@/lib/db/schema";
import { formatInTz } from "@/lib/settings/tz";

function formatWhen(ts: string | Date, tz: string) {
  return formatInTz(new Date(ts), tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type Props = {
  notifications: NotificationWithReadState[];
  total:         number;
  page:          number;
  pageSize:      number;
  businessTimezone: string;
};

export function NotificationList({ notifications, total, page, pageSize, businessTimezone }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = React.useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function goToPage(nextPage: number) {
    const params = new URLSearchParams();
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  async function handleMarkRead(id: string) {
    setPending(id);
    await markNotificationReadAction(id);
    router.refresh();
    setPending(null);
  }

  async function handleMarkAll() {
    setPending("all");
    await markAllNotificationsReadAction();
    router.refresh();
    setPending(null);
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={<Bell size={32} strokeWidth={1.5} />}
        title="No notifications yet"
        description="Order and production activity will show up here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)] max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </p>
        {unreadCount > 0 && (
          <Button size="sm" variant="secondary" onClick={handleMarkAll} disabled={pending === "all"}>
            {pending === "all" ? "Marking…" : "Mark all read"}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-[var(--space-2)]">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="flex items-start gap-[var(--space-3)] p-[var(--space-4)] rounded-[var(--radius-md)] border"
            style={{
              borderColor: "var(--color-border-subtle)",
              background:  n.isRead ? "var(--color-panel)" : "var(--color-brand-subtle)",
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
                {!n.isRead && <Badge variant="info">New</Badge>}
                <p className="text-[var(--text-sm)] font-[var(--weight-medium)]">{n.title}</p>
              </div>
              <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">{n.body}</p>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-[var(--space-2)]">
                {formatWhen(n.createdAt, businessTimezone)}
              </p>
            </div>
            {!n.isRead && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleMarkRead(n.id)}
                disabled={pending === n.id}
              >
                {pending === n.id ? "…" : "Mark read"}
              </Button>
            )}
          </div>
        ))}
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={goToPage} />
    </div>
  );
}
