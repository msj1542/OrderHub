/** Audit history — read-only timeline over the append-only audit_log table. */

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, users, orders, type AuditLogEntry } from "@/lib/db/schema";

export type AuditEntryWithNames = AuditLogEntry & {
  userName:     string | null;
  orderNumber:  string | null;
};

export async function listAuditLog(opts: { limit?: number; orderId?: string } = {}): Promise<AuditEntryWithNames[]> {
  const rows = await db
    .select({
      entry:       auditLog,
      userName:    users.name,
      orderNumber: orders.orderNumber,
    })
    .from(auditLog)
    .leftJoin(users,  eq(users.id, auditLog.userId))
    .leftJoin(orders, eq(orders.id, auditLog.orderId))
    .where(opts.orderId ? eq(auditLog.orderId, opts.orderId) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(opts.limit ?? 200);

  return rows.map(({ entry, userName, orderNumber }) => ({ ...entry, userName, orderNumber }));
}
