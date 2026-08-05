/** All role codes used in the application. */
export const ROLES = {
  INTERNAL_ADMIN:     "internal_admin",
  ORDER_COORDINATOR:  "order_coordinator",
  FULFILLMENT:        "fulfillment",
  ACCOUNTING:         "accounting",
  EXTERNAL_ADMIN:     "external_admin",
  EXTERNAL_ORDERING:  "external_ordering",
  EXTERNAL_REFERENCE: "external_reference",
} as const;

export type RoleCode = typeof ROLES[keyof typeof ROLES];

export const INTERNAL_ROLES = new Set<RoleCode>([
  ROLES.INTERNAL_ADMIN,
  ROLES.ORDER_COORDINATOR,
  ROLES.FULFILLMENT,
  ROLES.ACCOUNTING,
]);

export const EXTERNAL_ROLES = new Set<RoleCode>([
  ROLES.EXTERNAL_ADMIN,
  ROLES.EXTERNAL_ORDERING,
  ROLES.EXTERNAL_REFERENCE,
]);

export const ROLE_DISPLAY: Record<RoleCode, string> = {
  internal_admin:     "Internal Admin",
  order_coordinator:  "Order Coordinator",
  fulfillment:        "Fulfillment",
  accounting:         "Accounting",
  external_admin:     "Company Admin",
  external_ordering:  "Ordering User",
  external_reference: "Reference Only",
};

export function isInternal(roleCode: RoleCode | string): boolean {
  return INTERNAL_ROLES.has(roleCode as RoleCode);
}

export function isExternal(roleCode: RoleCode | string): boolean {
  return EXTERNAL_ROLES.has(roleCode as RoleCode);
}
