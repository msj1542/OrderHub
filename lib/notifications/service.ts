/**
 * Notification service — in-app notifications with per-user read tracking.
 *
 * Visibility model (mirrors the reference app):
 *   - userId set              → targeted to exactly that user
 *   - userId NULL, companyId  → broadcast to internal staff AND that company's users
 *   - userId NULL, no company → broadcast to internal staff only
 *
 * Read state is tracked per-user in `notification_reads` rather than a single
 * boolean column, because a broadcast notification is read independently by
 * every user who sees it — a shared boolean would mark it "read" for everyone
 * the instant any one recipient opened it.
 */

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  notifications, notificationReads, users,
  type AppUser, type Notification, type NotificationWithReadState,
} from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── Visibility ───────────────────────────────────────────────────

function visibilityCondition(user: AppUser) {
  if (user.role.isInternal) {
    return or(eq(notifications.userId, user.id), isNull(notifications.userId));
  }
  return or(
    eq(notifications.userId, user.id),
    and(isNull(notifications.userId), eq(notifications.companyId, user.companyId ?? "00000000-0000-0000-0000-000000000000")),
  );
}

// ── Create (called from within an existing transaction) ─────────

export type NewNotificationInput = {
  userId?:    string | null;
  companyId?: string | null;
  orderId?:   string | null;
  event:      string;
  title:      string;
  body:       string;
};

/** Insert a notification row as part of the caller's transaction. */
export async function insertNotification(tx: Tx, input: NewNotificationInput): Promise<void> {
  await tx.insert(notifications).values({
    userId:    input.userId ?? null,
    companyId: input.companyId ?? null,
    orderId:   input.orderId ?? null,
    event:     input.event,
    title:     input.title,
    body:      input.body,
  });
}

// ── List / counts ─────────────────────────────────────────────

export async function listNotifications(
  user: AppUser,
  opts: { onlyUnread?: boolean; limit?: number } = {},
): Promise<NotificationWithReadState[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(visibilityCondition(user))
    .orderBy(desc(notifications.createdAt))
    .limit(opts.limit ?? 100);

  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const readRows = await db
    .select({ notificationId: notificationReads.notificationId })
    .from(notificationReads)
    .where(and(inArray(notificationReads.notificationId, ids), eq(notificationReads.userId, user.id)));
  const readSet = new Set(readRows.map((r) => r.notificationId));

  const withRead = rows.map((n) => ({ ...n, isRead: readSet.has(n.id) }));
  return opts.onlyUnread ? withRead.filter((n) => !n.isRead) : withRead;
}

export async function getUnreadCount(user: AppUser): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(visibilityCondition(user));
  if (!rows.length) return 0;

  const ids = rows.map((r) => r.id);
  const readRows = await db
    .select({ notificationId: notificationReads.notificationId })
    .from(notificationReads)
    .where(and(inArray(notificationReads.notificationId, ids), eq(notificationReads.userId, user.id)));
  const readSet = new Set(readRows.map((r) => r.notificationId));

  return ids.filter((id) => !readSet.has(id)).length;
}

// ── Mark read ────────────────────────────────────────────────

export async function markNotificationRead(notificationId: string, user: AppUser): Promise<void> {
  const [visible] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), visibilityCondition(user)))
    .limit(1);
  if (!visible) throw new Error("Notification not found.");

  await db
    .insert(notificationReads)
    .values({ notificationId, userId: user.id })
    .onConflictDoNothing();
}

export async function markAllNotificationsRead(user: AppUser): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(visibilityCondition(user));
  if (!rows.length) return 0;

  await db
    .insert(notificationReads)
    .values(rows.map((r) => ({ notificationId: r.id, userId: user.id })))
    .onConflictDoNothing();

  return rows.length;
}

// ── Recipient resolution (for email) ────────────────────────────

/** Email address of the order's creator — the sole email recipient for order-lifecycle events. */
export async function getOrderCreatorEmail(createdByUserId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.id, createdByUserId), eq(users.isActive, true)))
    .limit(1);
  return row?.email ?? null;
}
