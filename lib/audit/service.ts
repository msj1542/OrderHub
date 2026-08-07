/** Audit history — read-only timeline over the append-only audit_log table. */

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, users, orders, type AuditLogEntry } from "@/lib/db/schema";

export type AuditEntryWithNames = AuditLogEntry & {
  userName:     string | null;
  orderNumber:  string | null;
};

export type AuditLogListResult = {
  entries: AuditEntryWithNames[];
  total:   number;
};

const MAX_ROWS = 200;

/**
 * @param opts.page/pageSize 1-indexed pagination; page defaults to 1, pageSize to 25.
 *   Total rows considered are capped at MAX_ROWS (200) regardless of pageSize — this is
 *   a read-only timeline, not a full export; use narrower filters (orderId) to go deeper.
 */
export async function listAuditLog(
  opts: { page?: number; pageSize?: number; orderId?: string } = {},
): Promise<AuditLogListResult> {
  const where = opts.orderId ? eq(auditLog.orderId, opts.orderId) : undefined;

  const countRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(where);
  const total = Math.min(countRow[0]?.count ?? 0, MAX_ROWS);

  const pageSize = opts.pageSize ?? 25;
  const page     = Math.max(1, opts.page ?? 1);
  const offset   = (page - 1) * pageSize;

  if (offset >= MAX_ROWS) return { entries: [], total };

  const rows = await db
    .select({
      entry:       auditLog,
      userName:    users.name,
      orderNumber: orders.orderNumber,
    })
    .from(auditLog)
    .leftJoin(users,  eq(users.id, auditLog.userId))
    .leftJoin(orders, eq(orders.id, auditLog.orderId))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(pageSize, MAX_ROWS - offset))
    .offset(offset);

  return {
    entries: rows.map(({ entry, userName, orderNumber }) => ({ ...entry, userName, orderNumber })),
    total,
  };
}
