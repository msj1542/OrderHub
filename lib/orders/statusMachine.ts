/**
 * Order status machine.
 *
 * Encodes valid from-statuses for each transition action.
 * Role checks are done separately via `can(user, action)` in authz/policy.ts.
 *
 * This module is the single source of truth for "is this transition valid?".
 * The service layer calls `assertCanTransition()` before every DB write.
 */

import type { Action } from "@/lib/authz/policy";
import type { OrderStatus } from "@/lib/db/schema";

export type OrderTransitionAction =
  | "submit"
  | "accept"
  | "claim"
  | "qc"
  | "invoice_verify"
  | "release"
  | "request_cancel"
  | "cancel"
  | "decline_cancel"
  | "delete_draft";

export type TransitionRule = {
  /** Valid "from" statuses for this action. */
  fromStatuses:  OrderStatus[];
  /** New status after the transition, or null if status doesn't change. */
  toStatus:      OrderStatus | null;
  /** The authz action that gates this transition. */
  authzAction:   Action;
};

export const TRANSITIONS: Record<OrderTransitionAction, TransitionRule> = {
  submit: {
    fromStatuses: ["draft"],
    toStatus:     "submitted",
    authzAction:  "order:submit",
  },
  accept: {
    fromStatuses: ["submitted"],
    toStatus:     "accepted",
    authzAction:  "order:accept",
  },
  claim: {
    fromStatuses: ["accepted", "in_fulfillment"],
    toStatus:     "in_fulfillment",
    authzAction:  "order:claim",
  },
  qc: {
    fromStatuses: ["in_fulfillment"],
    toStatus:     "fulfillment_completed",
    authzAction:  "order:qc",
  },
  invoice_verify: {
    fromStatuses: ["fulfillment_completed"],
    toStatus:     "ready_for_pickup",
    authzAction:  "order:invoice_verify",
  },
  release: {
    fromStatuses: ["ready_for_pickup"],
    toStatus:     "closed",
    authzAction:  "order:release",
  },
  request_cancel: {
    fromStatuses: ["submitted", "accepted"],
    toStatus:     null,
    authzAction:  "order:request_cancel",
  },
  cancel: {
    fromStatuses: ["submitted", "accepted"],
    toStatus:     "canceled",
    authzAction:  "order:cancel",
  },
  decline_cancel: {
    fromStatuses: ["submitted", "accepted"],
    toStatus:     null,
    authzAction:  "order:decline_cancel",
  },
  delete_draft: {
    fromStatuses: ["draft"],
    toStatus:     null,
    authzAction:  "order:delete_draft",
  },
};

/**
 * Returns the transition rule if the current status is a valid "from" status,
 * or null if the transition is not valid for the current status.
 */
export function getTransition(
  action: OrderTransitionAction,
  currentStatus: string,
): TransitionRule | null {
  const rule = TRANSITIONS[action];
  if (!rule) return null;
  if (!rule.fromStatuses.includes(currentStatus as OrderStatus)) return null;
  return rule;
}

/**
 * Throws if the transition is not valid for the current order status.
 */
export function assertCanTransition(
  action: OrderTransitionAction,
  currentStatus: string,
  label?: string,
): TransitionRule {
  const rule = getTransition(action, currentStatus);
  if (!rule) {
    throw new Error(
      label ?? `Cannot perform "${action}" when order is in "${currentStatus}" status.`,
    );
  }
  return rule;
}
