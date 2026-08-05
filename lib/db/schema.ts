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
