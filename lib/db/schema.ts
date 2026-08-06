import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  numeric,
  integer,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ── Phase 1: Auth & identity ──────────────────────────────────

export const roles = pgTable("roles", {
  roleCode:    text("role_code").primaryKey(),
  displayName: text("display_name").notNull(),
  isInternal:  boolean("is_internal").notNull().default(false),
});

export const companies = pgTable("companies", {
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name:           text("name").notNull(),
  orderScope:     text("order_scope").notNull().default("own"),
  pricingVisible: boolean("pricing_visible").notNull().default(true),
  notes:          text("notes"),
  isActive:       boolean("is_active").notNull().default(true),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const users = pgTable("users", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  authUserId:  uuid("auth_user_id").unique(),
  email:       text("email").notNull().unique(),
  name:        text("name").notNull(),
  roleCode:    text("role_code").notNull().references(() => roles.roleCode),
  companyId:   uuid("company_id").references(() => companies.id),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── Relations ─────────────────────────────────────────────────

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  role:    one(roles,     { fields: [users.roleCode],  references: [roles.roleCode] }),
  company: one(companies, { fields: [users.companyId], references: [companies.id]  }),
}));

// ── Phase 2: Catalog & materials ──────────────────────────────

export const materials = pgTable("materials", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:      text("code").notNull().unique(),
  name:      text("name").notNull(),
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const materialRollWidths = pgTable("material_roll_widths", {
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId:   uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  widthIn:      numeric("width_in", { precision: 8, scale: 4 }).notNull(),
  lengthFt:     numeric("length_ft", { precision: 8, scale: 4 }).notNull().default("100"),
  rollCost:     numeric("roll_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  handlingCost: numeric("handling_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  isActive:     boolean("is_active").notNull().default(true),
});

export const products = pgTable("products", {
  id:                   uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sku:                  text("sku").notNull().unique(),
  brand:                text("brand").notNull(),
  model:                text("model").notNull(),
  yearStart:            text("year_start"),
  partName:             text("part_name").notNull(),
  attr1:                text("attr1"),
  attr2:                text("attr2"),
  description:          text("description").notNull(),
  includedPieces:       text("included_pieces"),
  version:              text("version"),
  patternLengthIn:      numeric("pattern_length_in", { precision: 8, scale: 4 }),
  requiredRollWidthIn:  numeric("required_roll_width_in", { precision: 8, scale: 4 }),
  notes:                text("notes"),
  isActive:             boolean("is_active").notNull().default(true),
  customerVisible:      boolean("customer_visible").notNull().default(true),
  sourceReference:      text("source_reference"),
  thumbnailPath:        text("thumbnail_path"),
  priceListRevision:    text("price_list_revision"),
  priceEffectiveDate:   text("price_effective_date"),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const productMaterials = pgTable("product_materials", {
  productId:  uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
});

export const prices = pgTable("prices", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  productId:     uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  materialId:    uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  unitPrice:     numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  effectiveDate: text("effective_date").notNull(),
  revision:      text("revision"),
  isActive:      boolean("is_active").notNull().default(true),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const productFiles = pgTable("product_files", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  productId:   uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  label:       text("label").notNull(),
  filePath:    text("file_path").notNull(),
  mimeType:    text("mime_type"),
  sortOrder:   integer("sort_order").notNull().default(0),
  isThumbnail: boolean("is_thumbnail").notNull().default(false),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── Phase 2 relations ─────────────────────────────────────────

export const materialsRelations = relations(materials, ({ many }) => ({
  rollWidths:       many(materialRollWidths),
  productMaterials: many(productMaterials),
  prices:           many(prices),
}));

export const materialRollWidthsRelations = relations(materialRollWidths, ({ one }) => ({
  material: one(materials, { fields: [materialRollWidths.materialId], references: [materials.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  productMaterials: many(productMaterials),
  prices:           many(prices),
  files:            many(productFiles),
}));

export const productMaterialsRelations = relations(productMaterials, ({ one }) => ({
  product:  one(products,   { fields: [productMaterials.productId],  references: [products.id]   }),
  material: one(materials,  { fields: [productMaterials.materialId], references: [materials.id]  }),
}));

export const pricesRelations = relations(prices, ({ one }) => ({
  product:  one(products,  { fields: [prices.productId],  references: [products.id]  }),
  material: one(materials, { fields: [prices.materialId], references: [materials.id] }),
}));

export const productFilesRelations = relations(productFiles, ({ one }) => ({
  product: one(products, { fields: [productFiles.productId], references: [products.id] }),
}));

// ── Phase 3: Orders ───────────────────────────────────────────

export const applicationSettings = pgTable("application_settings", {
  key:        text("key").primaryKey(),
  value:      text("value").notNull(),
  modifiedBy: uuid("modified_by").references(() => users.id),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const orders = pgTable("orders", {
  id:                      uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber:             text("order_number").unique(),
  companyId:               uuid("company_id").notNull().references(() => companies.id),
  createdByUserId:         uuid("created_by_user_id").notNull().references(() => users.id),
  status:                  text("status").notNull().default("draft"),
  isExpedited:             boolean("is_expedited").notNull().default(false),
  requestedDate:           text("requested_date"),
  expectedCompletionDate:  text("expected_completion_date"),
  poNumber:                text("po_number"),
  supplementalToOrderId:   uuid("supplemental_to_order_id"),
  customerNotes:           text("customer_notes"),
  internalNotes:           text("internal_notes"),
  subtotal:                numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  rushFee:                 numeric("rush_fee", { precision: 12, scale: 2 }).notNull().default("0"),
  adjustment:              numeric("adjustment", { precision: 12, scale: 2 }).notNull().default("0"),
  adjustmentReason:        text("adjustment_reason"),
  grandTotal:              numeric("grand_total", { precision: 12, scale: 2 }).notNull().default("0"),
  cancellationRequested:   boolean("cancellation_requested").notNull().default(false),
  submittedAt:             timestamp("submitted_at", { withTimezone: true }),
  acceptedAt:              timestamp("accepted_at", { withTimezone: true }),
  releasedAt:              timestamp("released_at", { withTimezone: true }),
  closedAt:                timestamp("closed_at", { withTimezone: true }),
  createdAt:               timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt:               timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const orderLines = pgTable("order_lines", {
  id:                  uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId:             uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId:           uuid("product_id").references(() => products.id),
  materialId:          uuid("material_id").references(() => materials.id),
  skuSnapshot:         text("sku_snapshot").notNull(),
  descriptionSnapshot: text("description_snapshot").notNull(),
  attributesSnapshot:  text("attributes_snapshot"),
  quantity:            integer("quantity").notNull(),
  unitPrice:           numeric("unit_price", { precision: 12, scale: 2 }),
  lineTotal:           numeric("line_total", { precision: 12, scale: 2 }),
  pricingStatus:       text("pricing_status").notNull().default("priced"),
  isCustom:            boolean("is_custom").notNull().default(false),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const orderComments = pgTable("order_comments", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId:    uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  userId:     uuid("user_id").notNull().references(() => users.id),
  body:       text("body").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId:        uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  previousStatus: text("previous_status"),
  newStatus:      text("new_status").notNull(),
  changedBy:      uuid("changed_by").notNull().references(() => users.id),
  reason:         text("reason"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const cancellationRequests = pgTable("cancellation_requests", {
  id:                  uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId:             uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  requestedByUserId:   uuid("requested_by_user_id").notNull().references(() => users.id),
  reason:              text("reason"),
  status:              text("status").notNull().default("pending"),
  resolvedByUserId:    uuid("resolved_by_user_id").references(() => users.id),
  resolvedAt:          timestamp("resolved_at", { withTimezone: true }),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const auditLog = pgTable("audit_log", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:        uuid("user_id").references(() => users.id),
  companyId:     uuid("company_id").references(() => companies.id),
  orderId:       uuid("order_id").references(() => orders.id),
  entityType:    text("entity_type").notNull(),
  entityId:      text("entity_id"),
  action:        text("action").notNull(),
  previousValue: text("previous_value"),
  newValue:      text("new_value"),
  reason:        text("reason"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── Phase 3 relations ─────────────────────────────────────────

export const ordersRelations = relations(orders, ({ one, many }) => ({
  company:      one(companies, { fields: [orders.companyId],        references: [companies.id] }),
  createdBy:    one(users,     { fields: [orders.createdByUserId],  references: [users.id]     }),
  lines:        many(orderLines),
  comments:     many(orderComments),
  statusHistory: many(orderStatusHistory),
  cancellationRequests: many(cancellationRequests),
  workOrder:    one(productionWorkOrders, { fields: [orders.id], references: [productionWorkOrders.orderId] }),
}));

export const orderLinesRelations = relations(orderLines, ({ one }) => ({
  order:    one(orders,    { fields: [orderLines.orderId],    references: [orders.id]    }),
  product:  one(products,  { fields: [orderLines.productId],  references: [products.id]  }),
  material: one(materials, { fields: [orderLines.materialId], references: [materials.id] }),
}));

export const orderCommentsRelations = relations(orderComments, ({ one }) => ({
  order: one(orders, { fields: [orderComments.orderId], references: [orders.id] }),
  user:  one(users,  { fields: [orderComments.userId],  references: [users.id]  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order:     one(orders, { fields: [orderStatusHistory.orderId],    references: [orders.id] }),
  changedBy: one(users,  { fields: [orderStatusHistory.changedBy],  references: [users.id]  }),
}));

export const cancellationRequestsRelations = relations(cancellationRequests, ({ one }) => ({
  order:       one(orders, { fields: [cancellationRequests.orderId],           references: [orders.id] }),
  requestedBy: one(users,  { fields: [cancellationRequests.requestedByUserId], references: [users.id]  }),
  resolvedBy:  one(users,  { fields: [cancellationRequests.resolvedByUserId],  references: [users.id]  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user:    one(users,     { fields: [auditLog.userId],    references: [users.id]     }),
  company: one(companies, { fields: [auditLog.companyId], references: [companies.id] }),
  order:   one(orders,    { fields: [auditLog.orderId],   references: [orders.id]    }),
}));

// ── Phase 4: Production queue ─────────────────────────────────

export const productionWorkOrders = pgTable("production_work_orders", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId:         uuid("order_id").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
  status:          text("status").notNull().default("pending"),
  dueDate:         text("due_date"),
  claimedByUserId: uuid("claimed_by_user_id").references(() => users.id),
  startedAt:       timestamp("started_at",   { withTimezone: true }),
  completedAt:     timestamp("completed_at", { withTimezone: true }),
  releasedAt:      timestamp("released_at",  { withTimezone: true }),
  canceledAt:      timestamp("canceled_at",  { withTimezone: true }),
  createdAt:       timestamp("created_at",   { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt:       timestamp("updated_at",   { withTimezone: true }).notNull().default(sql`now()`),
});

export const productionLineProgress = pgTable("production_line_progress", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workOrderId:     uuid("work_order_id").notNull().references(() => productionWorkOrders.id, { onDelete: "cascade" }),
  orderLineId:     uuid("order_line_id").notNull().references(() => orderLines.id, { onDelete: "cascade" }),
  completedPieces: text("completed_pieces").notNull().default("[]"),
  modifiedBy:      uuid("modified_by").references(() => users.id),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const productionRecuts = pgTable("production_recuts", {
  id:                  uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workOrderId:         uuid("work_order_id").notNull().references(() => productionWorkOrders.id, { onDelete: "cascade" }),
  orderLineId:         uuid("order_line_id").notNull().references(() => orderLines.id, { onDelete: "cascade" }),
  quantity:            integer("quantity").notNull(),
  reason:              text("reason").notNull(),
  materialUsageInches: numeric("material_usage_inches", { precision: 10, scale: 4 }),
  recordedBy:          uuid("recorded_by").notNull().references(() => users.id),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const qcAttestations = pgTable("qc_attestations", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workOrderId: uuid("work_order_id").notNull().references(() => productionWorkOrders.id, { onDelete: "cascade" }),
  userId:      uuid("user_id").notNull().references(() => users.id),
  answers:     text("answers").notNull(),
  notes:       text("notes"),
  attested:    boolean("attested").notNull().default(false),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── Phase 5: Invoice verification ──────────────────────────────

export const invoiceVerifications = pgTable("invoice_verifications", {
  id:                uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId:           uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  userId:            uuid("user_id").notNull().references(() => users.id),
  invoiceNumber:     text("invoice_number"),
  invoiceTotal:      numeric("invoice_total", { precision: 12, scale: 2 }),
  discrepancyReason: text("discrepancy_reason"),
  attested:          boolean("attested").notNull().default(false),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const invoiceVerificationsRelations = relations(invoiceVerifications, ({ one }) => ({
  order: one(orders, { fields: [invoiceVerifications.orderId], references: [orders.id] }),
  user:  one(users,  { fields: [invoiceVerifications.userId],  references: [users.id]  }),
}));

// ── Phase 4 relations ─────────────────────────────────────────

export const productionWorkOrdersRelations = relations(productionWorkOrders, ({ one, many }) => ({
  order:           one(orders,    { fields: [productionWorkOrders.orderId],          references: [orders.id]    }),
  claimedBy:       one(users,     { fields: [productionWorkOrders.claimedByUserId],  references: [users.id]     }),
  lineProgress:    many(productionLineProgress),
  recuts:          many(productionRecuts),
  qcAttestations:  many(qcAttestations),
}));

export const productionLineProgressRelations = relations(productionLineProgress, ({ one }) => ({
  workOrder:  one(productionWorkOrders, { fields: [productionLineProgress.workOrderId],  references: [productionWorkOrders.id] }),
  orderLine:  one(orderLines,           { fields: [productionLineProgress.orderLineId],  references: [orderLines.id]           }),
  modifiedBy: one(users,                { fields: [productionLineProgress.modifiedBy],   references: [users.id]                }),
}));

export const productionRecutsRelations = relations(productionRecuts, ({ one }) => ({
  workOrder:   one(productionWorkOrders, { fields: [productionRecuts.workOrderId],   references: [productionWorkOrders.id] }),
  orderLine:   one(orderLines,           { fields: [productionRecuts.orderLineId],   references: [orderLines.id]           }),
  recordedBy:  one(users,                { fields: [productionRecuts.recordedBy],    references: [users.id]                }),
}));

export const qcAttestationsRelations = relations(qcAttestations, ({ one }) => ({
  workOrder: one(productionWorkOrders, { fields: [qcAttestations.workOrderId], references: [productionWorkOrders.id] }),
  user:      one(users,                { fields: [qcAttestations.userId],      references: [users.id]                }),
}));

// ── TypeScript types ──────────────────────────────────────────

export type Role    = typeof roles.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type User    = typeof users.$inferSelect;

export type NewCompany = typeof companies.$inferInsert;
export type NewUser    = typeof users.$inferInsert;

/** Full user row with resolved role and optional company — used throughout the app. */
export type AppUser = User & {
  role:    Role;
  company: Company | null;
};

// Phase 3 types
export type ApplicationSetting   = typeof applicationSettings.$inferSelect;
export type Order                = typeof orders.$inferSelect;
export type OrderLine            = typeof orderLines.$inferSelect;
export type OrderComment         = typeof orderComments.$inferSelect;
export type OrderStatusHistory   = typeof orderStatusHistory.$inferSelect;
export type CancellationRequest  = typeof cancellationRequests.$inferSelect;
export type AuditLogEntry        = typeof auditLog.$inferSelect;

export type NewOrder             = typeof orders.$inferInsert;
export type NewOrderLine         = typeof orderLines.$inferInsert;
export type NewOrderComment      = typeof orderComments.$inferInsert;

export type OrderStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "in_fulfillment"
  | "fulfillment_completed"
  | "ready_for_pickup"
  | "released"
  | "invoiced"
  | "closed"
  | "canceled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft:                 "Draft",
  submitted:             "Submitted",
  accepted:              "Accepted",
  in_fulfillment:        "In Fulfillment",
  fulfillment_completed: "Fulfillment Completed",
  ready_for_pickup:      "Ready for Pickup",
  released:              "Released",
  invoiced:              "Invoiced",
  closed:                "Closed",
  canceled:              "Canceled",
};

/** Order with company name, creator name, and line count — used in list views. */
export type OrderSummary = Order & {
  companyName: string;
  createdByName: string;
  lineCount: number;
};

/** Minimal work order data surfaced on the order detail page for internal users. */
export type OrderWorkOrderBrief = {
  id:            string;
  status:        string;
  dueDate:       string | null;
  claimedByName: string | null;
  totalPieces:   number;
  doneCount:     number;
};

/** Full order with lines, comments, pending cancellation request, and work order (internal only). */
export type OrderFull = Order & {
  companyName: string;
  createdByName: string;
  lines: (OrderLine & { materialName: string | null })[];
  comments: (OrderComment & { authorName: string })[];
  pendingCancellationRequest: (CancellationRequest & { requestedByName: string }) | null;
  workOrder: OrderWorkOrderBrief | null;
};

// Phase 4 types
export type ProductionWorkOrder  = typeof productionWorkOrders.$inferSelect;
export type ProductionLineProgress = typeof productionLineProgress.$inferSelect;
export type ProductionRecut      = typeof productionRecuts.$inferSelect;
export type QcAttestation        = typeof qcAttestations.$inferSelect;

export type InvoiceVerification    = typeof invoiceVerifications.$inferSelect;
export type NewInvoiceVerification = typeof invoiceVerifications.$inferInsert;

export type NewProductionWorkOrder    = typeof productionWorkOrders.$inferInsert;
export type NewProductionLineProgress = typeof productionLineProgress.$inferInsert;
export type NewProductionRecut        = typeof productionRecuts.$inferInsert;
export type NewQcAttestation          = typeof qcAttestations.$inferInsert;

export type WorkOrderStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "awaiting_pickup"
  | "released"
  | "canceled";

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending:         "New",
  in_progress:     "In Progress",
  completed:       "Completed",
  awaiting_pickup: "Awaiting Pickup",
  released:        "Released",
  canceled:        "Canceled",
};

export type WorkOrderSummary = ProductionWorkOrder & {
  orderNumber:   string | null;
  companyName:   string;
  isExpedited:   boolean;
  claimedByName: string | null;
  totalPieces:   number;
  doneCount:     number;
};

export type WorkOrderLineFull = OrderLine & {
  materialName:       string | null;
  patternLengthIn:    string | null;
  requiredRollWidthIn: string | null;
  progress:           { id: string; completedPieces: number[] } | null;
  recuts:             ProductionRecut[];
};

export type WorkOrderFull = ProductionWorkOrder & {
  orderNumber:            string | null;
  companyName:            string;
  isExpedited:            boolean;
  requestedDate:          string | null;
  expectedCompletionDate: string | null;
  claimedByName:          string | null;
  lines:                  WorkOrderLineFull[];
};

// Phase 2 types
export type Material         = typeof materials.$inferSelect;
export type MaterialRollWidth = typeof materialRollWidths.$inferSelect;
export type Product          = typeof products.$inferSelect;
export type ProductMaterial  = typeof productMaterials.$inferSelect;
export type Price            = typeof prices.$inferSelect;
export type ProductFile      = typeof productFiles.$inferSelect;

export type NewMaterial          = typeof materials.$inferInsert;
export type NewMaterialRollWidth = typeof materialRollWidths.$inferInsert;
export type NewProduct           = typeof products.$inferInsert;
export type NewPrice             = typeof prices.$inferInsert;
export type NewProductFile       = typeof productFiles.$inferInsert;

/** Material with its roll width options. */
export type MaterialWithRolls = Material & { rolls: MaterialRollWidth[] };

/** Product with its compatible materials and current prices. */
export type ProductWithMaterials = Product & {
  materials: MaterialWithRolls[];
  prices: Array<Price & { material: Material }>;
  /** UUID of the active thumbnail file, if one exists. Avoids loading the full files array in list context. */
  thumbnailFileId: string | null;
};

/** Product detail includes files too. */
export type ProductFull = ProductWithMaterials & { files: ProductFile[] };
