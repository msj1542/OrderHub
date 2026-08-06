/**
 * Order service — all order reads and writes go through here.
 *
 * Architecture: service-role Drizzle connection (bypasses RLS).
 * All data scoping is enforced explicitly via WHERE clauses.
 * All status transitions are transactional and role-gated.
 */

import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orders, orderLines, orderComments, orderStatusHistory,
  cancellationRequests, auditLog, materials,
  companies, users,
  type AppUser, type Order, type OrderFull, type OrderLine,
  type OrderSummary, type OrderStatus,
} from "@/lib/db/schema";
import { can } from "@/lib/authz/policy";
import { assertCanTransition } from "@/lib/orders/statusMachine";
import { checkDuplicatePO } from "@/lib/orders/duplicate";
import { getSettings, computeExpectedCompletion, computeRushFee } from "@/lib/settings/schedule";
import { toDecimal, addMoney } from "@/lib/pricing/money";

// ── Scoping helper ─────────────────────────────────────────────

function orderScopeCondition(user: AppUser) {
  if (user.role.isInternal) return undefined; // internal sees all
  const companyId = user.companyId;
  if (!companyId) return eq(orders.companyId, "00000000-0000-0000-0000-000000000000"); // no access
  if (user.company?.orderScope === "own") {
    return and(eq(orders.companyId, companyId), eq(orders.createdByUserId, user.id));
  }
  return eq(orders.companyId, companyId);
}

// ── List / get ─────────────────────────────────────────────────

export type OrderFilters = {
  status?:    OrderStatus;
  companyId?: string;
  search?:    string;
};

export async function listOrders(
  user: AppUser,
  filters: OrderFilters = {},
): Promise<OrderSummary[]> {
  const scope = orderScopeCondition(user);

  const conditions = scope ? [scope] : [];
  if (filters.status)    conditions.push(eq(orders.status, filters.status));
  if (filters.companyId && user.role.isInternal) conditions.push(eq(orders.companyId, filters.companyId));

  const rows = await db
    .select({
      order:       orders,
      companyName: companies.name,
      creatorName: users.name,
    })
    .from(orders)
    .innerJoin(companies, eq(companies.id, orders.companyId))
    .innerJoin(users,     eq(users.id,     orders.createdByUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.updatedAt));

  // Load line counts in one batch query
  const orderIds = rows.map((r) => r.order.id);
  const lineCounts =
    orderIds.length > 0
      ? await db
          .select({
            orderId:   orderLines.orderId,
            lineCount: sql<number>`count(*)::int`,
          })
          .from(orderLines)
          .where(inArray(orderLines.orderId, orderIds))
          .groupBy(orderLines.orderId)
      : [];

  const countMap = new Map(lineCounts.map((r) => [r.orderId, r.lineCount]));

  return rows.map(({ order, companyName, creatorName }) => ({
    ...order,
    companyName,
    createdByName: creatorName,
    lineCount: countMap.get(order.id) ?? 0,
  }));
}

export async function getOrder(
  id: string,
  user: AppUser,
): Promise<OrderFull | null> {
  const scope = orderScopeCondition(user);

  const rows = await db
    .select({
      order:       orders,
      companyName: companies.name,
      creatorName: users.name,
    })
    .from(orders)
    .innerJoin(companies, eq(companies.id, orders.companyId))
    .innerJoin(users,     eq(users.id,     orders.createdByUserId))
    .where(scope ? and(eq(orders.id, id), scope) : eq(orders.id, id))
    .limit(1);

  if (!rows.length) return null;
  const { order, companyName, creatorName } = rows[0];

  // Load lines with material names
  const lineRows = await db
    .select({ line: orderLines, materialName: materials.name })
    .from(orderLines)
    .leftJoin(materials, eq(materials.id, orderLines.materialId))
    .where(eq(orderLines.orderId, id))
    .orderBy(asc(orderLines.createdAt));

  // Load comments (external users never see is_internal=true)
  const commentConditions = [eq(orderComments.orderId, id)];
  if (!user.role.isInternal) commentConditions.push(eq(orderComments.isInternal, false));

  const commentRows = await db
    .select({ comment: orderComments, authorName: users.name })
    .from(orderComments)
    .innerJoin(users, eq(users.id, orderComments.userId))
    .where(and(...commentConditions))
    .orderBy(asc(orderComments.createdAt));

  // Load pending cancellation request
  const cancelRows = await db
    .select({ req: cancellationRequests, requestedByName: users.name })
    .from(cancellationRequests)
    .innerJoin(users, eq(users.id, cancellationRequests.requestedByUserId))
    .where(
      and(
        eq(cancellationRequests.orderId, id),
        eq(cancellationRequests.status, "pending"),
      ),
    )
    .limit(1);

  return {
    ...order,
    companyName,
    createdByName: creatorName,
    lines: lineRows.map(({ line, materialName }) => ({ ...line, materialName })),
    comments: commentRows.map(({ comment, authorName }) => ({ ...comment, authorName })),
    pendingCancellationRequest: cancelRows.length
      ? { ...cancelRows[0].req, requestedByName: cancelRows[0].requestedByName }
      : null,
  };
}

// ── Line input type ────────────────────────────────────────────

export type OrderLineInput =
  | {
      isCustom: false;
      productId:  string;
      materialId: string;
      quantity:   number;
    }
  | {
      isCustom:     true;
      description:  string;
      brand:        string;
      model:        string;
      modelYear:    string;
      coverageArea: string;
      materialId:   string;
      quantity:     number;
      notes?:       string;
    };

export type OrderDraftInput = {
  companyId:     string;
  poNumber?:     string;
  isExpedited?:  boolean;
  requestedDate?: string;
  customerNotes?: string;
  internalNotes?: string;
  lines:         OrderLineInput[];
  /** If provided, update this existing draft. */
  draftId?:      string;
  /** If provided, this is a supplemental order linked to a parent. */
  supplementalToOrderId?: string;
};

// ── Validate + resolve lines ───────────────────────────────────

import { products, productMaterials, prices, materialRollWidths } from "@/lib/db/schema";

type ResolvedLine = Omit<typeof orderLines.$inferInsert, "orderId">;

async function resolveLines(
  lineInputs: OrderLineInput[],
  user: AppUser,
): Promise<ResolvedLine[]> {
  const resolved: ResolvedLine[] = [];

  for (const line of lineInputs) {
    const qty = Number(line.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error("Every quantity must be a whole number greater than zero.");
    }

    if (line.isCustom) {
      if (!line.description || !line.brand || !line.model || !line.modelYear || !line.coverageArea) {
        throw new Error("Custom items require description, brand, model, year, and coverage area.");
      }
      const mat = await db.select().from(materials).where(eq(materials.id, line.materialId)).limit(1);
      if (!mat.length || !mat[0].isActive) throw new Error("Selected material is unavailable.");

      resolved.push({
        productId:           null,
        materialId:          line.materialId,
        skuSnapshot:         "CUSTOM",
        descriptionSnapshot: line.description,
        attributesSnapshot:  JSON.stringify({
          brand: line.brand, model: line.model, year: line.modelYear,
          coverageArea: line.coverageArea, notes: line.notes ?? "",
        }),
        quantity:       qty,
        unitPrice:      null,
        lineTotal:      null,
        pricingStatus:  "pricing_pending",
        isCustom:       true,
      });
      continue;
    }

    // Catalog line
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, line.productId), eq(products.isActive, true)))
      .limit(1);
    if (!product || (!user.role.isInternal && !product.customerVisible)) {
      throw new Error("A selected product is unavailable.");
    }

    const [mat] = await db
      .select()
      .from(materials)
      .where(and(eq(materials.id, line.materialId), eq(materials.isActive, true)))
      .limit(1);
    if (!mat) throw new Error(`Selected material is no longer available.`);

    // Check compatibility
    const [compat] = await db
      .select()
      .from(productMaterials)
      .where(
        and(
          eq(productMaterials.productId, product.id),
          eq(productMaterials.materialId, mat.id),
        ),
      )
      .limit(1);
    if (!compat) throw new Error(`${product.sku} is not approved for ${mat.name}.`);

    // Check roll availability
    if (!product.requiredRollWidthIn) {
      throw new Error(`${product.sku} needs a required roll width before it can be ordered.`);
    }
    const rollWidth = parseFloat(product.requiredRollWidthIn);
    const [roll] = await db
      .select()
      .from(materialRollWidths)
      .where(
        and(
          eq(materialRollWidths.materialId, mat.id),
          eq(materialRollWidths.isActive, true),
          gte(materialRollWidths.widthIn, toDecimal(rollWidth)),
        ),
      )
      .orderBy(asc(materialRollWidths.widthIn))
      .limit(1);
    if (!roll) {
      throw new Error(`${mat.name} has no roll wide enough for ${product.sku}.`);
    }

    // Get active price
    const [price] = await db
      .select()
      .from(prices)
      .where(
        and(
          eq(prices.productId, product.id),
          eq(prices.materialId, mat.id),
          eq(prices.isActive, true),
        ),
      )
      .orderBy(desc(prices.effectiveDate), desc(prices.createdAt))
      .limit(1);
    if (!price) throw new Error(`${product.sku} has no valid ${mat.name} pricing.`);

    const unitPrice = parseFloat(price.unitPrice);
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;

    resolved.push({
      productId:           product.id,
      materialId:          mat.id,
      skuSnapshot:         product.sku,
      descriptionSnapshot: product.description,
      attributesSnapshot:  JSON.stringify({
        brand: product.brand, model: product.model, year: product.yearStart ?? "",
        part: product.partName, attr1: product.attr1 ?? "", attr2: product.attr2 ?? "",
      }),
      quantity:      qty,
      unitPrice:     toDecimal(unitPrice),
      lineTotal:     toDecimal(lineTotal),
      pricingStatus: "priced",
      isCustom:      false,
    });
  }

  return resolved;
}

// ── Save / submit ──────────────────────────────────────────────

export async function saveOrSubmitOrder(
  user: AppUser,
  input: OrderDraftInput,
  mode: "draft" | "submit",
): Promise<{ orderId: string; orderNumber: string | null; status: string }> {
  if (!can(user, "order:create")) {
    throw new Error("You do not have order-entry permission.");
  }
  if (!input.lines.length) throw new Error("Add at least one line item.");
  if (input.isExpedited && !input.requestedDate) {
    throw new Error("Requested completion date is required for expedited orders.");
  }

  // Validate supplemental parent
  if (input.supplementalToOrderId) {
    const [parent] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, input.supplementalToOrderId))
      .limit(1);
    if (!parent || parent.companyId !== input.companyId || parent.status === "draft") {
      throw new Error("Supplemental orders must reference a submitted order for this company.");
    }
  }

  const settings = await getSettings();
  const resolvedLines = await resolveLines(input.lines, user);

  const subtotal = resolvedLines.reduce((sum, l) => addMoney(sum, parseFloat(l.lineTotal ?? "0")), 0);
  const rushFee  = input.isExpedited ? computeRushFee(subtotal, settings) : 0;
  const grandTotal = addMoney(subtotal, rushFee);
  const expectedCompletion = computeExpectedCompletion(settings, new Date());

  // Duplicate PO check (only on submit, not draft)
  if (mode === "submit" && input.poNumber?.trim()) {
    const dupeCheck = await checkDuplicatePO({
      companyId:       input.companyId,
      poNumber:        input.poNumber,
      windowDays:      settings.duplicateWindowDays,
      excludeOrderId:  input.draftId,
    });
    if (dupeCheck.isDuplicate) {
      const ref = dupeCheck.existingOrderNumber ?? `order ID ${dupeCheck.existingOrderId}`;
      throw Object.assign(
        new Error(`Possible duplicate: ${ref} already uses PO ${input.poNumber} within the ${settings.duplicateWindowDays}-day window.`),
        { code: "duplicate_order", existingOrderId: dupeCheck.existingOrderId },
      );
    }
  }

  const now = new Date();
  const newStatus: OrderStatus = mode === "submit" ? "submitted" : "draft";

  const orderValues = {
    companyId:              input.companyId,
    createdByUserId:        user.id,
    status:                 newStatus,
    isExpedited:            input.isExpedited ?? false,
    requestedDate:          input.requestedDate ?? null,
    expectedCompletionDate: expectedCompletion,
    poNumber:               input.poNumber?.trim() || null,
    supplementalToOrderId:  input.supplementalToOrderId ?? null,
    customerNotes:          input.customerNotes?.trim() || null,
    internalNotes:          user.role.isInternal ? input.internalNotes?.trim() || null : null,
    subtotal:               toDecimal(subtotal),
    rushFee:                toDecimal(rushFee),
    grandTotal:             toDecimal(grandTotal),
    submittedAt:            mode === "submit" ? now : null,
    updatedAt:              now,
  };

  return await db.transaction(async (tx) => {
    let orderId: string;
    let previousStatus: string | null = null;

    if (input.draftId) {
      // Verify ownership of the draft
      const [existingDraft] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.draftId))
        .limit(1);
      if (
        !existingDraft ||
        existingDraft.status !== "draft" ||
        (!user.role.isInternal &&
          (existingDraft.companyId !== input.companyId ||
           existingDraft.createdByUserId !== user.id))
      ) {
        throw new Error("This draft is no longer editable.");
      }
      previousStatus = existingDraft.status;
      await tx.update(orders).set(orderValues).where(eq(orders.id, input.draftId));
      orderId = input.draftId;
      // Replace all lines
      await tx.delete(orderLines).where(eq(orderLines.orderId, orderId));
    } else {
      const [inserted] = await tx.insert(orders).values(orderValues).returning({ id: orders.id });
      orderId = inserted.id;
    }

    // Insert lines
    if (resolvedLines.length > 0) {
      await tx.insert(orderLines).values(resolvedLines.map((l) => ({ ...l, orderId })));
    }

    // Generate order number on submit
    let orderNumber: string | null = null;
    if (mode === "submit") {
      const [{ seq }] = await tx.execute<{ seq: string }>(
        sql`SELECT nextval('public.order_number_seq') AS seq`,
      );
      const year = now.getFullYear();
      orderNumber = `OH-${year}-${String(seq).padStart(5, "0")}`;
      await tx.update(orders).set({ orderNumber }).where(eq(orders.id, orderId));
    }

    // Status history
    await tx.insert(orderStatusHistory).values({
      orderId,
      previousStatus,
      newStatus,
      changedBy: user.id,
    });

    // Audit log
    await tx.insert(auditLog).values({
      userId:     user.id,
      companyId:  input.companyId,
      orderId,
      entityType: "Order",
      entityId:   orderId,
      action:     mode === "submit" ? "Order submitted" : "Draft saved",
      newValue:   JSON.stringify({ orderNumber, subtotal, rushFee, lineCount: resolvedLines.length }),
    });

    return { orderId, orderNumber, status: newStatus };
  });
}

// ── Delete draft ───────────────────────────────────────────────

export async function deleteDraft(orderId: string, user: AppUser): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found.");

  assertCanTransition("delete_draft", order.status);
  if (!can(user, "order:delete_draft")) throw new Error("Permission denied.");

  // External users can only delete their own drafts
  if (!user.role.isInternal && order.createdByUserId !== user.id) {
    throw new Error("You can only delete your own drafts.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(orders).where(eq(orders.id, orderId));
    // Audit log survives (audit_log has no cascade delete on order_id)
    await tx.insert(auditLog).values({
      userId:     user.id,
      companyId:  order.companyId,
      entityType: "Order Draft",
      entityId:   orderId,
      action:     "Draft deleted",
    });
  });
}

// ── Add comment ────────────────────────────────────────────────

export async function addComment(
  orderId: string,
  user: AppUser,
  body: string,
  isInternal: boolean,
): Promise<void> {
  const message = body.trim();
  if (!message) throw new Error("Comment cannot be blank.");

  // Internal-only comments require internal permission
  if (isInternal && !can(user, "order:comment_internal")) {
    throw new Error("You cannot add internal notes.");
  }
  if (!isInternal && !can(user, "order:comment_customer")) {
    throw new Error("You cannot add comments to orders.");
  }
  // External users cannot post internal notes
  if (!user.role.isInternal && isInternal) {
    throw new Error("External users cannot add internal notes.");
  }

  // Verify the user can see this order
  const scope = orderScopeCondition(user);
  const rows = await db
    .select({ id: orders.id, companyId: orders.companyId })
    .from(orders)
    .where(scope ? and(eq(orders.id, orderId), scope) : eq(orders.id, orderId))
    .limit(1);
  if (!rows.length) throw new Error("Order not found.");

  await db.transaction(async (tx) => {
    await tx.insert(orderComments).values({
      orderId,
      userId:     user.id,
      body:       message,
      isInternal,
    });
    await tx.insert(auditLog).values({
      userId:     user.id,
      companyId:  rows[0].companyId,
      orderId,
      entityType: isInternal ? "Internal Note" : "Customer Comment",
      entityId:   orderId,
      action:     isInternal ? "Internal note added" : "Customer-visible comment added",
    });
  });
}

// ── Accept order ───────────────────────────────────────────────

export async function acceptOrder(
  orderId: string,
  user: AppUser,
  expectedCompletionDate?: string,
): Promise<Order> {
  if (!can(user, "order:accept")) throw new Error("Permission denied.");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found.");

  const rule = assertCanTransition("accept", order.status, "This order cannot be accepted.");

  const now = new Date();
  const completionDate = expectedCompletionDate || order.expectedCompletionDate;

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({
        status:                 rule.toStatus!,
        expectedCompletionDate: completionDate,
        acceptedAt:             now,
        updatedAt:              now,
      })
      .where(eq(orders.id, orderId))
      .returning();

    await tx.insert(orderStatusHistory).values({
      orderId,
      previousStatus: order.status,
      newStatus:      rule.toStatus!,
      changedBy:      user.id,
    });
    await tx.insert(auditLog).values({
      userId:         user.id,
      companyId:      order.companyId,
      orderId,
      entityType:     "Order",
      entityId:       orderId,
      action:         "Status changed",
      previousValue:  order.status,
      newValue:       rule.toStatus!,
    });

    return updated;
  });
}

// ── Request cancellation (external) ───────────────────────────

export async function requestCancellation(
  orderId: string,
  user: AppUser,
  reason: string,
): Promise<void> {
  if (!can(user, "order:request_cancel")) throw new Error("Permission denied.");
  if (!reason.trim()) throw new Error("A cancellation reason is required.");

  const scope = orderScopeCondition(user);
  const rows = await db
    .select()
    .from(orders)
    .where(scope ? and(eq(orders.id, orderId), scope) : eq(orders.id, orderId))
    .limit(1);
  if (!rows.length) throw new Error("Order not found.");

  const order = rows[0];
  assertCanTransition("request_cancel", order.status, "Cancellation can no longer be requested.");

  if (order.cancellationRequested) {
    throw new Error("A cancellation request is already pending for this order.");
  }

  await db.transaction(async (tx) => {
    await tx.insert(cancellationRequests).values({
      orderId,
      requestedByUserId: user.id,
      reason:            reason.trim(),
    });
    await tx.update(orders).set({ cancellationRequested: true, updatedAt: new Date() }).where(eq(orders.id, orderId));
    await tx.insert(auditLog).values({
      userId:     user.id,
      companyId:  order.companyId,
      orderId,
      entityType: "Order",
      entityId:   orderId,
      action:     "Cancellation requested",
      reason:     reason.trim(),
    });
  });
}

// ── Cancel order (internal) ────────────────────────────────────

export async function cancelOrder(
  orderId: string,
  user: AppUser,
  reason: string,
): Promise<Order> {
  if (!can(user, "order:cancel")) throw new Error("Permission denied.");
  if (!reason.trim()) throw new Error("A cancellation reason is required.");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found.");

  const rule = assertCanTransition("cancel", order.status, "This order cannot be canceled.");
  const now = new Date();

  return await db.transaction(async (tx) => {
    // Resolve any pending cancellation request
    await tx
      .update(cancellationRequests)
      .set({ status: "approved", resolvedByUserId: user.id, resolvedAt: now })
      .where(and(eq(cancellationRequests.orderId, orderId), eq(cancellationRequests.status, "pending")));

    const [updated] = await tx
      .update(orders)
      .set({
        status:                "canceled",
        cancellationRequested: false,
        updatedAt:             now,
      })
      .where(eq(orders.id, orderId))
      .returning();

    await tx.insert(orderStatusHistory).values({
      orderId,
      previousStatus: order.status,
      newStatus:      rule.toStatus!,
      changedBy:      user.id,
      reason:         reason.trim(),
    });
    await tx.insert(auditLog).values({
      userId:        user.id,
      companyId:     order.companyId,
      orderId,
      entityType:    "Order",
      entityId:      orderId,
      action:        "Status changed",
      previousValue: order.status,
      newValue:      "canceled",
      reason:        reason.trim(),
    });

    return updated;
  });
}

// ── Decline cancellation ───────────────────────────────────────

export async function declineCancellation(
  orderId: string,
  user: AppUser,
  reason?: string,
): Promise<void> {
  if (!can(user, "order:decline_cancel")) throw new Error("Permission denied.");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found.");

  assertCanTransition("decline_cancel", order.status);
  if (!order.cancellationRequested) throw new Error("No cancellation request is pending for this order.");

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(cancellationRequests)
      .set({ status: "declined", resolvedByUserId: user.id, resolvedAt: now })
      .where(and(eq(cancellationRequests.orderId, orderId), eq(cancellationRequests.status, "pending")));

    await tx.update(orders).set({ cancellationRequested: false, updatedAt: now }).where(eq(orders.id, orderId));

    await tx.insert(auditLog).values({
      userId:     user.id,
      companyId:  order.companyId,
      orderId,
      entityType: "Order",
      entityId:   orderId,
      action:     "Cancellation request declined",
      reason:     reason ?? null,
    });
  });
}

// ── Dashboard counts ───────────────────────────────────────────

export type DashboardCounts = {
  submittedCount:    number;
  expeditedCount:    number;
  cancellationCount: number;
  draftCount:        number;
};

export async function getDashboardCounts(user: AppUser): Promise<DashboardCounts> {
  if (user.role.isInternal) {
    const [submitted]    = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "submitted"));
    const [expedited]    = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.isExpedited, true), inArray(orders.status as any, ["submitted", "accepted", "in_fulfillment"])));
    const [cancellation] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.cancellationRequested, true));
    return {
      submittedCount:    submitted.n,
      expeditedCount:    expedited.n,
      cancellationCount: cancellation.n,
      draftCount:        0,
    };
  } else {
    const scope = orderScopeCondition(user);
    const conds = scope ? [scope] : [];
    const [drafts] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(...conds, eq(orders.status, "draft")));
    const submitted = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(...conds, or(eq(orders.status, "submitted"), eq(orders.status, "accepted"))));
    return {
      submittedCount:    submitted[0].n,
      expeditedCount:    0,
      cancellationCount: 0,
      draftCount:        drafts.n,
    };
  }
}
