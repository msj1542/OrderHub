import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
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
