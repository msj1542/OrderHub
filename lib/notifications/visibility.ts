/**
 * Pure mirror of the notification visibility rule.
 *
 * This must stay in sync with two other implementations of the same rule:
 *   - `visibilityCondition()` in lib/notifications/service.ts (the Drizzle
 *     query condition used for app reads)
 *   - the `notifications_select_*` RLS policies in
 *     supabase/migrations/0006_phase6.sql (the actual Realtime access boundary)
 *
 * Kept here, pure and DB-free, so the rule itself is unit-testable.
 */

export type NotificationVisibilityInput = {
  userId:    string | null;
  companyId: string | null;
};

export type ViewerVisibilityInput = {
  id:         string;
  companyId:  string | null;
  isInternal: boolean;
};

export function canSeeNotification(
  notification: NotificationVisibilityInput,
  viewer: ViewerVisibilityInput,
): boolean {
  if (notification.userId === viewer.id) return true;
  if (notification.userId !== null) return false; // targeted at someone else

  // Broadcast (userId is null).
  if (viewer.isInternal) return true; // internal staff see every broadcast
  return notification.companyId !== null && notification.companyId === viewer.companyId;
}
