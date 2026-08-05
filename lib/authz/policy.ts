/**
 * Single source of truth for role × action authorization.
 *
 * All permission checks in the app go through `can(user, action)`.
 * The status-machine guard (which order state a transition is valid from)
 * is a separate concern added in Phase 3/4 — this module only encodes
 * the role-level permission, not the state-machine validity.
 */

import { ROLES, type RoleCode } from "./roles";
import type { AppUser } from "@/lib/db/schema";

// ── Action catalog ─────────────────────────────────────────────

export type Action =
  // Orders
  | "order:create"
  | "order:delete_draft"
  | "order:submit"
  | "order:accept"
  | "order:claim"
  | "order:qc"
  | "order:invoice_verify"
  | "order:release"
  | "order:close"
  | "order:request_cancel"
  | "order:cancel"
  | "order:decline_cancel"
  | "order:comment_internal"
  | "order:comment_customer"
  | "order:print_labels"
  // Production
  | "production:view"
  | "production:manage"
  // Catalog
  | "catalog:view"
  | "catalog:manage"
  // Materials
  | "materials:manage"
  // Resources
  | "resources:download"
  | "resources:manage"
  // Pricing visibility
  | "pricing:view"
  // Users & companies
  | "users:manage_internal"
  | "users:manage_external"
  | "companies:manage"
  // Settings
  | "settings:manage"
  // Portal preview (admin sees what a customer sees)
  | "portal:preview";

// ── Role → allowed actions map ─────────────────────────────────
// internal_admin is handled separately (has every internal permission).
const ROLE_PERMISSIONS: Partial<Record<RoleCode, Set<Action>>> = {
  [ROLES.ORDER_COORDINATOR]: new Set<Action>([
    "order:create", "order:delete_draft", "order:submit", "order:accept",
    "order:request_cancel", "order:cancel", "order:decline_cancel",
    "order:comment_internal", "order:comment_customer", "order:print_labels",
    "order:release",
    "production:view",
    "catalog:view",
    "resources:download", "resources:manage",
    "pricing:view",
    "users:manage_external",
    "portal:preview",
  ]),

  [ROLES.FULFILLMENT]: new Set<Action>([
    "order:claim", "order:qc",
    "order:comment_internal", "order:print_labels",
    "production:view", "production:manage",
    "catalog:view",
    "resources:download",
    "pricing:view",
  ]),

  [ROLES.ACCOUNTING]: new Set<Action>([
    "order:invoice_verify", "order:close",
    "order:comment_internal",
    "production:view",
    "catalog:view",
    "resources:download",
    "pricing:view",
  ]),

  [ROLES.EXTERNAL_ADMIN]: new Set<Action>([
    "order:create", "order:delete_draft", "order:submit",
    "order:request_cancel", "order:comment_customer",
    "catalog:view",
    "resources:download",
    "users:manage_external",
    // pricing:view depends on company.pricing_visible — checked separately
  ]),

  [ROLES.EXTERNAL_ORDERING]: new Set<Action>([
    "order:create", "order:delete_draft", "order:submit",
    "order:request_cancel", "order:comment_customer",
    "catalog:view",
    "resources:download",
    // pricing:view depends on company.pricing_visible — checked separately
  ]),

  [ROLES.EXTERNAL_REFERENCE]: new Set<Action>([
    "catalog:view",
    "resources:download",
    // pricing:view depends on company.pricing_visible — checked separately
  ]),
};

// Actions internal_admin can perform (every internal action).
const INTERNAL_ADMIN_ACTIONS = new Set<Action>([
  "order:create", "order:delete_draft", "order:submit", "order:accept",
  "order:claim", "order:qc", "order:invoice_verify", "order:release",
  "order:close", "order:request_cancel", "order:cancel", "order:decline_cancel",
  "order:comment_internal", "order:comment_customer", "order:print_labels",
  "production:view", "production:manage",
  "catalog:view", "catalog:manage",
  "materials:manage",
  "resources:download", "resources:manage",
  "pricing:view",
  "users:manage_internal", "users:manage_external",
  "companies:manage",
  "settings:manage",
  "portal:preview",
]);

// ── can() ──────────────────────────────────────────────────────

/**
 * Returns true if the user is allowed to perform the action.
 *
 * For `pricing:view` on external users, this also checks
 * `user.company.pricing_visible` — callers don't need to handle that
 * case separately.
 */
export function can(user: AppUser, action: Action): boolean {
  const role = user.roleCode as RoleCode;

  if (role === ROLES.INTERNAL_ADMIN) return INTERNAL_ADMIN_ACTIONS.has(action);

  // External pricing visibility is company-controlled (decision #4).
  if (action === "pricing:view") {
    if (user.role.isInternal) return true;
    return user.company?.pricingVisible ?? false;
  }

  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

/**
 * Returns true if the user is allowed to perform ANY of the given actions.
 * Useful for rendering nav items that represent multiple possible flows.
 */
export function canAny(user: AppUser, actions: Action[]): boolean {
  return actions.some((a) => can(user, a));
}
