/**
 * Production queue service — work order reads/writes.
 *
 * Architecture: service-role Drizzle connection (bypasses RLS).
 * All data scoping is enforced via explicit WHERE clauses.
 */

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  orders, orderLines, orderStatusHistory, auditLog,
  materials, products, companies, users,
  productionWorkOrders, productionLineProgress, productionRecuts, qcAttestations,
  type AppUser, type WorkOrderFull, type WorkOrderLineFull, type WorkOrderSummary,
} from "@/lib/db/schema";
import { can } from "@/lib/authz/policy";
import { assertCanTransition } from "@/lib/orders/statusMachine";
import { claimOrder } from "@/lib/orders/service";
import { toDecimal } from "@/lib/pricing/money";
import { insertNotification } from "@/lib/notifications/service";

// ── QC constants ───────────────────────────────────────────────
// Defined in lib/production/constants.ts (a pure, DB-free module) so client
// components can import them without pulling in the Postgres driver.
// Re-exported here for existing consumers (tests, other server code).

import { QC_ITEMS, QC_KEYS } from "@/lib/production/constants";
export { QC_ITEMS, QC_KEYS };

// ── Tab filter ─────────────────────────────────────────────────

export type WorkOrderTab = "current" | "completed" | "archived" | "all";

const TAB_STATUSES: Record<WorkOrderTab, string[]> = {
  current:   ["pending", "in_progress"],
  completed: ["completed", "awaiting_pickup"],
  archived:  ["released", "canceled"],
  all:       [],
};

// ── List work orders ───────────────────────────────────────────

export type WorkOrderListFilters = {
  /** 1-indexed page number. Omit (or pass neither page nor pageSize) to return every matching row, unpaginated. */
  page?:     number;
  pageSize?: number;
};

export type WorkOrderListResult = {
  workOrders: WorkOrderSummary[];
  total:      number;
};

export async function listWorkOrders(
  user: AppUser,
  tab: WorkOrderTab = "current",
  filters: WorkOrderListFilters = {},
): Promise<WorkOrderListResult> {
  if (!can(user, "production:view")) throw new Error("Permission denied.");

  const statusFilter = TAB_STATUSES[tab];
  const conditions   = statusFilter.length > 0
    ? [inArray(productionWorkOrders.status, statusFilter)]
    : [];
  const where = conditions.length ? and(...conditions) : undefined;

  const claimedUser = alias(users, "claimed_user");

  const countRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productionWorkOrders)
    .where(where);
  const total = countRow[0]?.count ?? 0;

  let query = db
    .select({
      wo:            productionWorkOrders,
      orderNumber:   orders.orderNumber,
      isExpedited:   orders.isExpedited,
      companyName:   companies.name,
      claimedByName: claimedUser.name,
    })
    .from(productionWorkOrders)
    .innerJoin(orders,      eq(orders.id,     productionWorkOrders.orderId))
    .innerJoin(companies,   eq(companies.id,  orders.companyId))
    .leftJoin(claimedUser,  eq(claimedUser.id, productionWorkOrders.claimedByUserId))
    .where(where)
    .orderBy(desc(productionWorkOrders.createdAt))
    .$dynamic();

  if (filters.page || filters.pageSize) {
    const pageSize = filters.pageSize ?? 25;
    const page     = Math.max(1, filters.page ?? 1);
    query = query.limit(pageSize).offset((page - 1) * pageSize);
  }

  const rows = await query;

  if (!rows.length) return { workOrders: [], total };

  const woIds    = rows.map((r) => r.wo.id);
  const orderIds = rows.map((r) => r.wo.orderId);

  // Total pieces per order (sum of line quantities)
  const pieceTotals = await db
    .select({
      orderId:     orderLines.orderId,
      totalPieces: sql<number>`sum(${orderLines.quantity})::int`,
    })
    .from(orderLines)
    .where(inArray(orderLines.orderId, orderIds))
    .groupBy(orderLines.orderId);

  // Completed piece counts (count elements in JSON arrays)
  const progressRows = await db
    .select({
      workOrderId:     productionLineProgress.workOrderId,
      completedPieces: productionLineProgress.completedPieces,
    })
    .from(productionLineProgress)
    .where(inArray(productionLineProgress.workOrderId, woIds));

  const pieceTotalMap = new Map(pieceTotals.map((r) => [r.orderId, r.totalPieces]));

  const doneCountMap = new Map<string, number>();
  for (const row of progressRows) {
    const pieces = JSON.parse(row.completedPieces) as number[];
    doneCountMap.set(row.workOrderId, (doneCountMap.get(row.workOrderId) ?? 0) + pieces.length);
  }

  return {
    workOrders: rows.map(({ wo, orderNumber, isExpedited, companyName, claimedByName }) => ({
      ...wo,
      orderNumber,
      companyName,
      isExpedited:   isExpedited ?? false,
      claimedByName: claimedByName ?? null,
      totalPieces:   pieceTotalMap.get(wo.orderId) ?? 0,
      doneCount:     doneCountMap.get(wo.id) ?? 0,
    })),
    total,
  };
}

// ── Get full work order ────────────────────────────────────────

export async function getWorkOrder(
  workOrderId: string,
  user: AppUser,
): Promise<WorkOrderFull | null> {
  if (!can(user, "production:view")) throw new Error("Permission denied.");

  const claimedUser = alias(users, "claimed_user");

  const rows = await db
    .select({
      wo:                     productionWorkOrders,
      orderNumber:            orders.orderNumber,
      isExpedited:            orders.isExpedited,
      requestedDate:          orders.requestedDate,
      expectedCompletionDate: orders.expectedCompletionDate,
      orderId:                orders.id,
      companyName:            companies.name,
      claimedByName:          claimedUser.name,
    })
    .from(productionWorkOrders)
    .innerJoin(orders,     eq(orders.id,     productionWorkOrders.orderId))
    .innerJoin(companies,  eq(companies.id,  orders.companyId))
    .leftJoin(claimedUser, eq(claimedUser.id, productionWorkOrders.claimedByUserId))
    .where(eq(productionWorkOrders.id, workOrderId))
    .limit(1);

  if (!rows.length) return null;
  const r = rows[0];

  // Lines with product + material info
  const lineRows = await db
    .select({
      line:               orderLines,
      materialName:       materials.name,
      patternLengthIn:    products.patternLengthIn,
      requiredRollWidthIn: products.requiredRollWidthIn,
    })
    .from(orderLines)
    .leftJoin(materials, eq(materials.id, orderLines.materialId))
    .leftJoin(products,  eq(products.id,  orderLines.productId))
    .where(eq(orderLines.orderId, r.orderId))
    .orderBy(asc(orderLines.createdAt));

  const lineIds = lineRows.map((l) => l.line.id);

  // Progress rows
  const progressRows = lineIds.length
    ? await db
        .select()
        .from(productionLineProgress)
        .where(and(
          eq(productionLineProgress.workOrderId, workOrderId),
          inArray(productionLineProgress.orderLineId, lineIds),
        ))
    : [];

  // Recut rows (all for this work order, ordered by line then created_at)
  const recutRows = await db
    .select()
    .from(productionRecuts)
    .where(eq(productionRecuts.workOrderId, workOrderId))
    .orderBy(asc(productionRecuts.createdAt));

  const progressByLineId = new Map(
    progressRows.map((p) => [
      p.orderLineId,
      { id: p.id, completedPieces: JSON.parse(p.completedPieces) as number[] },
    ]),
  );
  const recutsByLineId = new Map<string, typeof recutRows>();
  for (const recut of recutRows) {
    const list = recutsByLineId.get(recut.orderLineId) ?? [];
    list.push(recut);
    recutsByLineId.set(recut.orderLineId, list);
  }

  const lines: WorkOrderLineFull[] = lineRows.map(
    ({ line, materialName, patternLengthIn, requiredRollWidthIn }) => ({
      ...line,
      materialName:        materialName ?? null,
      patternLengthIn:     patternLengthIn ?? null,
      requiredRollWidthIn: requiredRollWidthIn ?? null,
      progress:            progressByLineId.get(line.id) ?? null,
      recuts:              recutsByLineId.get(line.id) ?? [],
    }),
  );

  return {
    ...r.wo,
    orderNumber:            r.orderNumber,
    companyName:            r.companyName,
    isExpedited:            r.isExpedited ?? false,
    requestedDate:          r.requestedDate,
    expectedCompletionDate: r.expectedCompletionDate,
    claimedByName:          r.claimedByName ?? null,
    lines,
  };
}

// ── Claim work order ───────────────────────────────────────────

export async function claimWorkOrder(
  workOrderId: string,
  user: AppUser,
): Promise<void> {
  const [wo] = await db
    .select({ orderId: productionWorkOrders.orderId })
    .from(productionWorkOrders)
    .where(eq(productionWorkOrders.id, workOrderId))
    .limit(1);
  if (!wo) throw new Error("Work order not found.");
  await claimOrder(wo.orderId, user);
}

// ── Update piece progress ──────────────────────────────────────

export async function updatePieceProgress(
  workOrderId: string,
  orderLineId: string,
  completedPieces: number[],
  user: AppUser,
): Promise<void> {
  if (!can(user, "production:manage")) throw new Error("Permission denied.");

  const [wo] = await db
    .select()
    .from(productionWorkOrders)
    .where(eq(productionWorkOrders.id, workOrderId))
    .limit(1);
  if (!wo) throw new Error("Work order not found.");
  if (wo.status !== "in_progress") throw new Error("Work order is not in progress.");

  const [line] = await db
    .select()
    .from(orderLines)
    .where(and(eq(orderLines.id, orderLineId), eq(orderLines.orderId, wo.orderId)))
    .limit(1);
  if (!line) throw new Error("Line not found on this order.");

  // Validate piece numbers are within range and unique
  const unique = [...new Set(completedPieces)].filter(
    (p) => Number.isInteger(p) && p >= 1 && p <= line.quantity,
  );
  const sorted = unique.sort((a, b) => a - b);
  const piecesJson = JSON.stringify(sorted);

  const [existing] = await db
    .select({ id: productionLineProgress.id })
    .from(productionLineProgress)
    .where(
      and(
        eq(productionLineProgress.workOrderId, workOrderId),
        eq(productionLineProgress.orderLineId, orderLineId),
      ),
    )
    .limit(1);

  const now = new Date();
  if (existing) {
    await db
      .update(productionLineProgress)
      .set({ completedPieces: piecesJson, modifiedBy: user.id, updatedAt: now })
      .where(eq(productionLineProgress.id, existing.id));
  } else {
    await db.insert(productionLineProgress).values({
      workOrderId,
      orderLineId,
      completedPieces: piecesJson,
      modifiedBy: user.id,
    });
  }
}

// ── Record non-billable recut ──────────────────────────────────

export async function recordRecut(
  workOrderId: string,
  orderLineId: string,
  quantity: number,
  reason: string,
  user: AppUser,
): Promise<void> {
  if (!can(user, "production:manage")) throw new Error("Permission denied.");
  if (!reason.trim()) throw new Error("A reason is required.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Quantity must be a whole number ≥ 1.");

  const [wo] = await db
    .select()
    .from(productionWorkOrders)
    .where(eq(productionWorkOrders.id, workOrderId))
    .limit(1);
  if (!wo) throw new Error("Work order not found.");
  if (!["in_progress", "completed", "awaiting_pickup"].includes(wo.status)) {
    throw new Error("Recuts can only be recorded for active work orders.");
  }

  const [lineRow] = await db
    .select({ line: orderLines, patternLengthIn: products.patternLengthIn })
    .from(orderLines)
    .leftJoin(products, eq(products.id, orderLines.productId))
    .where(and(eq(orderLines.id, orderLineId), eq(orderLines.orderId, wo.orderId)))
    .limit(1);
  if (!lineRow) throw new Error("Line not found on this order.");

  if (quantity > lineRow.line.quantity) {
    throw new Error(`Recut quantity cannot exceed the line quantity of ${lineRow.line.quantity}.`);
  }

  // Material usage: (patternLengthIn + 1 inch cutting margin) × quantity
  const patternLength     = parseFloat(lineRow.patternLengthIn ?? "0");
  const materialUsageIn   = (patternLength + 1) * quantity;

  await db.insert(productionRecuts).values({
    workOrderId,
    orderLineId,
    quantity,
    reason:              reason.trim(),
    materialUsageInches: toDecimal(materialUsageIn),
    recordedBy:          user.id,
  });
}

// ── Submit QC ─────────────────────────────────────────────────

export async function submitQC(
  workOrderId: string,
  answers: Record<string, boolean>,
  notes: string | null,
  user: AppUser,
): Promise<void> {
  if (!can(user, "order:qc")) throw new Error("Permission denied.");

  // All QC keys must be true
  for (const key of QC_KEYS) {
    if (!answers[key]) throw new Error(`All QC items must be checked before finalizing.`);
  }

  const [wo] = await db
    .select()
    .from(productionWorkOrders)
    .where(eq(productionWorkOrders.id, workOrderId))
    .limit(1);
  if (!wo) throw new Error("Work order not found.");
  if (wo.status !== "in_progress") throw new Error("Work order must be in progress to submit QC.");

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, wo.orderId))
    .limit(1);
  if (!order) throw new Error("Associated order not found.");

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(qcAttestations).values({
      workOrderId,
      userId:   user.id,
      answers:  JSON.stringify(answers),
      notes:    notes?.trim() || null,
      attested: true,
    });

    await tx
      .update(productionWorkOrders)
      .set({ status: "completed", completedAt: now, updatedAt: now })
      .where(eq(productionWorkOrders.id, workOrderId));

    const rule = assertCanTransition("qc", order.status, "This order cannot be QC-completed.");

    await tx
      .update(orders)
      .set({ status: rule.toStatus!, updatedAt: now })
      .where(eq(orders.id, wo.orderId));

    await tx.insert(orderStatusHistory).values({
      orderId:        wo.orderId,
      previousStatus: order.status,
      newStatus:      rule.toStatus!,
      changedBy:      user.id,
    });

    await tx.insert(auditLog).values({
      userId:        user.id,
      companyId:     order.companyId,
      orderId:       wo.orderId,
      entityType:    "Order",
      entityId:      wo.orderId,
      action:        "QC completed",
      previousValue: order.status,
      newValue:      rule.toStatus!,
    });

    await insertNotification(tx, {
      orderId: wo.orderId,
      event:   "fulfillment_completed",
      title:   `${order.orderNumber} requires invoice verification`,
      body:    "Fulfillment and QC are complete. Enter and verify the external invoice before release.",
    });
  });
}
