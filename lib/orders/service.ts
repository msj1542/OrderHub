/**
 * Order service — all order reads and writes go through here.
 *
 * Architecture: service-role Drizzle connection (bypasses RLS).
 * All data scoping is enforced explicitly via WHERE clauses.
 * All status transitions are transactional and role-gated.
 */

import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  orders, orderLines, orderComments, orderStatusHistory,
  cancellationRequests, auditLog, materials, invoiceVerifications,
  companies, users, productionWorkOrders, productionLineProgress, notifications,
  type AppUser, type Order, type OrderFull, type OrderLine,
  type OrderSummary, type OrderStatus,
} from "@/lib/db/schema";
import { can } from "@/lib/authz/policy";
import { assertCanTransition } from "@/lib/orders/statusMachine";
import { checkDuplicatePO } from "@/lib/orders/duplicate";
import { getSettings, computeExpectedCompletion, computeRushFee } from "@/lib/settings/schedule";
import { toDecimal, addMoney } from "@/lib/pricing/money";
import { validateInvoiceVerification, type InvoiceVerificationInput } from "@/lib/orders/invoiceVerification";
import { insertNotification, getOrderCreatorEmail } from "@/lib/notifications/service";
import { sendEmail } from "@/lib/notifications/email";

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
  /** 1-indexed page number. Omit (or pass neither page nor pageSize) to return every matching row, unpaginated. */
  page?:      number;
  pageSize?:  number;
};

export type OrderListResult = {
  orders: OrderSummary[];
  total:  number;
};

export async function listOrders(
  user: AppUser,
  filters: OrderFilters = {},
): Promise<OrderListResult> {
  const scope = orderScopeCondition(user);

  const conditions = scope ? [scope] : [];
  if (filters.status)    conditions.push(eq(orders.status, filters.status));
  if (filters.companyId && user.role.isInternal) conditions.push(eq(orders.companyId, filters.companyId));
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(orders.orderNumber, q),
        ilike(orders.poNumber, q),
        ilike(companies.name, q),
        ilike(users.name, q),
      )!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const countRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .innerJoin(companies, eq(companies.id, orders.companyId))
    .innerJoin(users,     eq(users.id,     orders.createdByUserId))
    .where(where);
  const total = countRow[0]?.count ?? 0;

  let query = db
    .select({
      order:       orders,
      companyName: companies.name,
      creatorName: users.name,
    })
    .from(orders)
    .innerJoin(companies, eq(companies.id, orders.companyId))
    .innerJoin(users,     eq(users.id,     orders.createdByUserId))
    .where(where)
    .orderBy(desc(orders.updatedAt))
    .$dynamic();

  if (filters.page || filters.pageSize) {
    const pageSize = filters.pageSize ?? 25;
    const page     = Math.max(1, filters.page ?? 1);
    query = query.limit(pageSize).offset((page - 1) * pageSize);
  }

  const rows = await query;

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

  return {
    orders: rows.map(({ order, companyName, creatorName }) => ({
      ...order,
      companyName,
      createdByName: creatorName,
      lineCount: countMap.get(order.id) ?? 0,
    })),
    total,
  };
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

  // Load work order brief (internal users only)
  let workOrder: OrderFull["workOrder"] = null;
  if (user.role.isInternal) {
    const claimedUser = alias(users, "claimed_user");
    const woRows = await db
      .select({
        id:            productionWorkOrders.id,
        status:        productionWorkOrders.status,
        dueDate:       productionWorkOrders.dueDate,
        claimedByName: claimedUser.name,
      })
      .from(productionWorkOrders)
      .leftJoin(claimedUser, eq(claimedUser.id, productionWorkOrders.claimedByUserId))
      .where(eq(productionWorkOrders.orderId, id))
      .limit(1);

    if (woRows.length) {
      const wo = woRows[0];
      const totalPieces = lineRows.reduce((sum, { line }) => sum + line.quantity, 0);
      const progressRows = await db
        .select({ completedPieces: productionLineProgress.completedPieces })
        .from(productionLineProgress)
        .where(eq(productionLineProgress.workOrderId, wo.id));
      const doneCount = progressRows.reduce(
        (sum, r) => sum + (JSON.parse(r.completedPieces) as number[]).length,
        0,
      );
      workOrder = {
        id:            wo.id,
        status:        wo.status,
        dueDate:       wo.dueDate,
        claimedByName: wo.claimedByName ?? null,
        totalPieces,
        doneCount,
      };
    }
  }

  // Load invoice verification for customer-visible invoice info
  const ivRows = await db
    .select({ invoiceNumber: invoiceVerifications.invoiceNumber, invoiceUrl: invoiceVerifications.invoiceUrl })
    .from(invoiceVerifications)
    .where(eq(invoiceVerifications.orderId, id))
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
    workOrder,
    invoiceNumber: ivRows[0]?.invoiceNumber ?? null,
    invoiceUrl: ivRows[0]?.invoiceUrl ?? null,
  };
}

// ── Line input type ────────────────────────────────────────────

export type OrderLineInput =
  | {
      isCustom:       false;
      productId:      string;
      materialId:     string;
      quantity:       number;
      isExpedited?:   boolean;
      requestedDate?: string | null;
    }
  | {
      isCustom:       true;
      description:    string;
      brand:          string;
      model:          string;
      modelYear:      string;
      coverageArea:   string;
      materialId:     string;
      quantity:       number;
      notes?:         string;
      isExpedited?:   boolean;
      requestedDate?: string | null;
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
        isExpedited:    !!line.isExpedited,
        requestedDate:  line.requestedDate ?? null,
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
      isExpedited:   !!line.isExpedited,
      requestedDate: line.requestedDate ?? null,
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
    throw new Error("Each expedited item must have a requested date.");
  }

  // Validate supplemental parent — lookup runs under the requester's own scope
  // (company/own), so a user can't attach a supplemental order to a parent
  // order they aren't otherwise allowed to see (audit fix #11).
  if (input.supplementalToOrderId) {
    const parentScope = orderScopeCondition(user);
    const [parent] = await db
      .select()
      .from(orders)
      .where(
        parentScope
          ? and(eq(orders.id, input.supplementalToOrderId), parentScope)
          : eq(orders.id, input.supplementalToOrderId),
      )
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

    if (mode === "submit") {
      await insertNotification(tx, {
        companyId: input.companyId,
        orderId,
        event:     "order_submitted_customer",
        title:     `${orderNumber} received`,
        body:      "Your order has been received and is awaiting review. You'll be notified when it's accepted.",
      });
      await insertNotification(tx, {
        orderId,
        event: "order_submitted_internal",
        title: `New order ${orderNumber} needs acknowledgment`,
        body:  "Review the expected completion date, pricing, and any expedited request.",
      });
    }

    return { orderId, orderNumber, status: newStatus };
  }).then(async (result) => {
    if (mode === "submit") {
      const email = await getOrderCreatorEmail(user.id);
      if (email) {
        await sendEmail({
          to:      email,
          subject: `${result.orderNumber} received`,
          html:    `<p>We've recorded order <strong>${result.orderNumber}</strong>. It has not yet been accepted into production — we'll let you know when it is.</p>`,
        }).catch(() => {});
      }
    }
    return result;
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
    // Detach references that lack ON DELETE CASCADE so the delete succeeds
    await tx.update(auditLog).set({ orderId: null }).where(eq(auditLog.orderId, orderId));
    await tx.update(notifications).set({ orderId: null }).where(eq(notifications.orderId, orderId));

    await tx.delete(orders).where(eq(orders.id, orderId));
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

// ── Submit draft ──────────────────────────────────────────────

export async function submitDraft(orderId: string, user: AppUser): Promise<Order> {
  if (!can(user, "order:submit")) throw new Error("Permission denied.");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found.");

  const rule = assertCanTransition("submit", order.status, "Only draft orders can be submitted.");
  const now = new Date();

  return await db.transaction(async (tx) => {
    const [{ seq }] = await tx.execute<{ seq: string }>(
      sql`SELECT nextval('public.order_number_seq') AS seq`,
    );
    const year = now.getFullYear();
    const orderNumber = `OH-${year}-${String(seq).padStart(5, "0")}`;

    const [updated] = await tx
      .update(orders)
      .set({ status: rule.toStatus!, orderNumber, submittedAt: now, updatedAt: now })
      .where(eq(orders.id, orderId))
      .returning();

    await tx.insert(orderStatusHistory).values({
      orderId,
      previousStatus: order.status,
      newStatus:      rule.toStatus!,
      changedBy:      user.id,
    });
    await tx.insert(auditLog).values({
      userId:        user.id,
      companyId:     order.companyId,
      orderId,
      entityType:    "Order",
      entityId:      orderId,
      action:        "Order submitted",
      previousValue: order.status,
      newValue:      rule.toStatus!,
    });

    await insertNotification(tx, {
      companyId: order.companyId,
      orderId,
      event:     "order_submitted_customer",
      title:     `Order ${orderNumber} submitted`,
      body:      "Your order has been submitted for review.",
    });

    return updated;
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

    // Create production work order (one per order, created on accept)
    await tx.insert(productionWorkOrders).values({
      orderId,
      status:    "pending",
      dueDate:   completionDate ?? null,
      updatedAt: now,
      createdAt: now,
    });

    await insertNotification(tx, {
      companyId: order.companyId,
      orderId,
      event:     "order_accepted",
      title:     `${order.orderNumber} accepted`,
      body:      "Your order has been reviewed and accepted. We'll notify you when it's ready for pickup.",
    });

    return updated;
  }).then(async (updated) => {
    const email = await getOrderCreatorEmail(order.createdByUserId);
    if (email) {
      await sendEmail({
        to:      email,
        subject: `${order.orderNumber} accepted`,
        html:    `<p>Order <strong>${order.orderNumber}</strong> has been reviewed and accepted. We'll notify you when it's ready for pickup.</p>`,
      }).catch(() => {});
    }
    return updated;
  });
}

// ── Claim order (start fulfillment) ───────────────────────────

export async function claimOrder(
  orderId: string,
  user: AppUser,
): Promise<Order> {
  if (!can(user, "order:claim")) throw new Error("Permission denied.");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found.");

  const rule = assertCanTransition("claim", order.status, "This order cannot be claimed.");
  const now  = new Date();
  const statusChanged = order.status !== rule.toStatus;

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({ status: rule.toStatus!, updatedAt: now })
      .where(eq(orders.id, orderId))
      .returning();

    // Advance work order: pending → in_progress (idempotent if already in_progress)
    await tx
      .update(productionWorkOrders)
      .set({
        status:          "in_progress",
        claimedByUserId: user.id,
        startedAt:       now,
        updatedAt:       now,
      })
      .where(
        and(
          eq(productionWorkOrders.orderId, orderId),
          inArray(productionWorkOrders.status, ["pending", "in_progress"]),
        ),
      );

    if (statusChanged) {
      await tx.insert(orderStatusHistory).values({
        orderId,
        previousStatus: order.status,
        newStatus:      rule.toStatus!,
        changedBy:      user.id,
      });
    }
    await tx.insert(auditLog).values({
      userId:        user.id,
      companyId:     order.companyId,
      orderId,
      entityType:    "Order",
      entityId:      orderId,
      action:        statusChanged ? "Status changed" : "Work order claimed",
      previousValue: order.status,
      newValue:      rule.toStatus!,
    });

    return updated;
  });
}

// ── Invoice verification ────────────────────────────────────────

export async function invoiceVerifyOrder(
  orderId: string,
  input: InvoiceVerificationInput,
  user: AppUser,
): Promise<Order> {
  if (!can(user, "order:invoice_verify")) throw new Error("Permission denied.");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found.");

  const rule = assertCanTransition(
    "invoice_verify",
    order.status,
    "This order is not ready for invoice verification.",
  );

  const validationError = validateInvoiceVerification(input, parseFloat(order.grandTotal));
  if (validationError) throw new Error(validationError);

  const now = new Date();

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({ status: rule.toStatus!, updatedAt: now })
      .where(eq(orders.id, orderId))
      .returning();

    await tx
      .update(productionWorkOrders)
      .set({ status: "awaiting_pickup", updatedAt: now })
      .where(eq(productionWorkOrders.orderId, orderId));

    await tx.insert(invoiceVerifications).values({
      orderId,
      userId:            user.id,
      invoiceNumber:      input.invoiceNumber.trim(),
      invoiceUrl:         input.invoiceUrl.trim() || null,
      invoiceTotal:       input.invoiceTotal !== null ? toDecimal(input.invoiceTotal) : null,
      discrepancyReason:  input.discrepancyReason.trim() || null,
      attested:           true,
    });

    await tx.insert(orderStatusHistory).values({
      orderId,
      previousStatus: order.status,
      newStatus:      rule.toStatus!,
      changedBy:      user.id,
    });
    await tx.insert(auditLog).values({
      userId:        user.id,
      companyId:     order.companyId,
      orderId,
      entityType:    "Order",
      entityId:      orderId,
      action:        "Invoice verified",
      previousValue: order.status,
      newValue:      rule.toStatus!,
      reason:        input.discrepancyReason.trim() || null,
    });

    await insertNotification(tx, {
      companyId: order.companyId,
      orderId,
      event:     "ready_for_pickup",
      title:     `${order.orderNumber} is ready for pickup`,
      body:      "Your order is complete and ready for pickup. Contact us to arrange collection.",
    });

    return updated;
  }).then(async (updated) => {
    const email = await getOrderCreatorEmail(order.createdByUserId);
    if (email) {
      await sendEmail({
        to:      email,
        subject: `${order.orderNumber} is ready for pickup`,
        html:    `<p>Order <strong>${order.orderNumber}</strong> is complete and ready for pickup. Contact us to arrange collection.</p>`,
      }).catch(() => {});
    }
    return updated;
  });
}

// ── Release order ────────────────────────────────────────────

export async function releaseOrder(orderId: string, user: AppUser): Promise<Order> {
  if (!can(user, "order:release")) throw new Error("Permission denied.");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found.");

  const rule = assertCanTransition("release", order.status, "This order cannot be released.");
  const now = new Date();

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({ status: rule.toStatus!, releasedAt: now, closedAt: now, updatedAt: now })
      .where(eq(orders.id, orderId))
      .returning();

    await tx
      .update(productionWorkOrders)
      .set({ status: "released", releasedAt: now, updatedAt: now })
      .where(eq(productionWorkOrders.orderId, orderId));

    await tx.insert(orderStatusHistory).values({
      orderId,
      previousStatus: order.status,
      newStatus:      rule.toStatus!,
      changedBy:      user.id,
    });
    await tx.insert(auditLog).values({
      userId:        user.id,
      companyId:     order.companyId,
      orderId,
      entityType:    "Order",
      entityId:      orderId,
      action:        "Status changed",
      previousValue: order.status,
      newValue:      rule.toStatus!,
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
    await insertNotification(tx, {
      orderId,
      event: "cancellation_requested",
      title: `Cancellation requested for ${order.orderNumber}`,
      body:  reason.trim(),
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
  submittedCount:        number;
  expeditedCount:        number;
  cancellationCount:     number;
  draftCount:            number;
  pendingWorkOrderCount: number;
  dueThisWeekCount:      number;
  overdueCount:          number;
};

export type DashboardAction = {
  key:         string;
  label:       string;
  detail:      string;
  orderId:     string;
  orderNumber: string | null;
  companyName: string;
  isExpedited: boolean;
  dueDate:     string | null;
  target:      "orders" | "production";
};

export async function getDashboardCounts(user: AppUser): Promise<DashboardCounts> {
  if (user.role.isInternal) {
    const nowISO = new Date().toISOString().slice(0, 10);
    const weekFromNow = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

    const [submitted, expedited, cancellation, pendingWO, dueThisWeek, overdue] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "submitted")),
      db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.isExpedited, true), inArray(orders.status as any, ["submitted", "accepted", "in_fulfillment"]))),
      db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.cancellationRequested, true)),
      db.select({ n: sql<number>`count(*)::int` }).from(productionWorkOrders).where(eq(productionWorkOrders.status, "pending")),
      db.select({ n: sql<number>`count(*)::int` }).from(orders).where(
        and(
          inArray(orders.status as any, ["submitted", "accepted", "in_fulfillment", "fulfillment_completed"]),
          gte(orders.expectedCompletionDate, nowISO),
          sql`${orders.expectedCompletionDate} <= ${weekFromNow}`,
        ),
      ),
      db.select({ n: sql<number>`count(*)::int` }).from(orders).where(
        and(
          inArray(orders.status as any, ["submitted", "accepted", "in_fulfillment", "fulfillment_completed"]),
          sql`${orders.expectedCompletionDate} < ${nowISO}`,
        ),
      ),
    ]);
    return {
      submittedCount:        submitted[0].n,
      expeditedCount:        expedited[0].n,
      cancellationCount:     cancellation[0].n,
      draftCount:            0,
      pendingWorkOrderCount: pendingWO[0].n,
      dueThisWeekCount:      dueThisWeek[0].n,
      overdueCount:          overdue[0].n,
    };
  } else {
    const scope = orderScopeCondition(user);
    const conds = scope ? [scope] : [];
    const [drafts] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(...conds, eq(orders.status, "draft")));
    const submitted = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(...conds, or(eq(orders.status, "submitted"), eq(orders.status, "accepted"))));
    const [accepted] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(...conds, eq(orders.status, "accepted")));
    const [ready]    = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(...conds, eq(orders.status, "ready_for_pickup")));
    return {
      submittedCount:        submitted[0].n,
      expeditedCount:        accepted.n,
      cancellationCount:     ready.n,
      draftCount:            drafts.n,
      pendingWorkOrderCount: 0,
      dueThisWeekCount:      0,
      overdueCount:          0,
    };
  }
}

export async function getDashboardActions(user: AppUser): Promise<DashboardAction[]> {
  if (!user.role.isInternal) return [];

  const creator = alias(users, "creator");
  const company = alias(companies, "co");

  const actions: DashboardAction[] = [];

  if (can(user, "order:accept")) {
    const submitted = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        companyName: company.name,
        isExpedited: orders.isExpedited,
        expectedCompletionDate: orders.expectedCompletionDate,
        cancellationRequested: orders.cancellationRequested,
        status: orders.status,
      })
      .from(orders)
      .innerJoin(company, eq(orders.companyId, company.id))
      .where(
        or(
          eq(orders.status, "submitted"),
          and(eq(orders.status, "fulfillment_completed"), eq(orders.cancellationRequested, false)),
          eq(orders.cancellationRequested, true),
        ),
      )
      .orderBy(desc(orders.isExpedited), asc(orders.createdAt))
      .limit(10);

    for (const o of submitted) {
      if (o.cancellationRequested) {
        actions.push({ key: `cancel-${o.id}`, label: "Cancellation request needs review", detail: "Customer decision required", orderId: o.id, orderNumber: o.orderNumber, companyName: o.companyName, isExpedited: o.isExpedited, dueDate: o.expectedCompletionDate, target: "orders" });
      } else if (o.status === "submitted") {
        actions.push({ key: `review-${o.id}`, label: "New order needs review and acceptance", detail: "Customer order awaiting acknowledgment", orderId: o.id, orderNumber: o.orderNumber, companyName: o.companyName, isExpedited: o.isExpedited, dueDate: o.expectedCompletionDate, target: "orders" });
      } else if (o.status === "fulfillment_completed") {
        actions.push({ key: `invoice-${o.id}`, label: "Invoice verification required", detail: "Production is complete", orderId: o.id, orderNumber: o.orderNumber, companyName: o.companyName, isExpedited: o.isExpedited, dueDate: o.expectedCompletionDate, target: "orders" });
      }
    }
  }

  if (can(user, "production:manage")) {
    const pendingWOs = await db
      .select({
        woId: productionWorkOrders.id,
        woStatus: productionWorkOrders.status,
        orderId: productionWorkOrders.orderId,
        orderNumber: orders.orderNumber,
        companyName: company.name,
        isExpedited: orders.isExpedited,
        dueDate: productionWorkOrders.dueDate,
      })
      .from(productionWorkOrders)
      .innerJoin(orders, eq(productionWorkOrders.orderId, orders.id))
      .innerJoin(company, eq(orders.companyId, company.id))
      .where(inArray(productionWorkOrders.status, ["pending", "in_progress"]))
      .orderBy(desc(orders.isExpedited), asc(productionWorkOrders.createdAt))
      .limit(10);

    for (const wo of pendingWOs) {
      actions.push({
        key: `production-${wo.woId}`,
        label: wo.woStatus === "pending" ? "New work order ready to begin" : "Production work needs attention",
        detail: wo.woStatus === "pending" ? "New work order" : "Work in progress",
        orderId: wo.orderId,
        orderNumber: wo.orderNumber,
        companyName: wo.companyName,
        isExpedited: wo.isExpedited,
        dueDate: wo.dueDate,
        target: "production",
      });
    }
  }

  return actions.slice(0, 7);
}

export async function getSidebarBadges(user: AppUser): Promise<{ orders: number; production: number }> {
  if (user.role.isInternal) {
    const [[submitted], [needsAction], [pendingWO]] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "submitted")),
      db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "fulfillment_completed")),
      db.select({ n: sql<number>`count(*)::int` }).from(productionWorkOrders).where(eq(productionWorkOrders.status, "pending")),
    ]);
    return { orders: submitted.n + needsAction.n, production: pendingWO.n };
  }
  // External users: count their own orders that are in active states
  const scope = orderScopeCondition(user);
  const conditions = [
    inArray(orders.status, ["submitted", "accepted", "in_fulfillment"]),
  ];
  if (scope) conditions.push(scope);
  const [active] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(...conditions));
  return { orders: active.n, production: 0 };
}
