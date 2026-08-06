/**
 * Duplicate PO detection.
 *
 * Blocks re-submission of the same PO number within a configurable window
 * (default: 3 days). Check runs at submit time — never at draft creation.
 *
 * Audit fix #1: one checkDuplicatePO() used by every submit path.
 */

import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";

export type DuplicateCheckResult =
  | { isDuplicate: false }
  | { isDuplicate: true; existingOrderNumber: string | null; existingOrderId: string };

/**
 * Check whether `poNumber` was already used for a submitted (non-draft) order
 * for this company within `windowDays` days.
 *
 * @param excludeOrderId  The draft being submitted — exclude it from the check.
 */
export async function checkDuplicatePO(opts: {
  companyId:       string;
  poNumber:        string;
  windowDays:      number;
  excludeOrderId?: string;
}): Promise<DuplicateCheckResult> {
  const { companyId, poNumber, windowDays, excludeOrderId } = opts;

  if (!poNumber.trim()) return { isDuplicate: false };

  const cutoff = new Date(Date.now() - windowDays * 86_400_000);

  const candidates = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status })
    .from(orders)
    .where(
      and(
        eq(orders.companyId, companyId),
        eq(orders.poNumber, poNumber.trim()),
        gte(orders.createdAt, cutoff),
        excludeOrderId ? ne(orders.id, excludeOrderId) : undefined,
      ),
    );

  const match = candidates.find((o) => o.status !== "draft");
  if (!match) return { isDuplicate: false };

  return {
    isDuplicate:          true,
    existingOrderId:      match.id,
    existingOrderNumber:  match.orderNumber,
  };
}
