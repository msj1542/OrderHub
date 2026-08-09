import { cn } from "@/lib/utils";

export type StatusFamily =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "urgent"
  | "completed";

/**
 * Single source of truth for order/work-order status → color family.
 * REBUILD_PLAN.md "Status map" — extend here, never invent a one-off pair.
 */
export const ORDER_STATUS_FAMILY: Record<string, StatusFamily> = {
  draft: "neutral",
  submitted: "warning",
  accepted: "success",
  in_fulfillment: "info",
  fulfillment_completed: "completed",
  ready_for_pickup: "success",
  released: "success",
  invoiced: "neutral",
  closed: "neutral",
  canceled: "danger",
};

/**
 * `ready_for_pickup` reads differently depending on audience: internal staff
 * care that the customer hasn't collected it yet (reuse the work order's
 * "Awaiting Pickup" amber styling), while customers want the affirmative
 * green "Ready for Pickup" cue. Same underlying order status either way.
 */
export function orderStatusDisplay(
  status: string,
  defaultLabel: string,
  isInternal: boolean,
): { label: string; family: StatusFamily } {
  if (isInternal && status === "ready_for_pickup") {
    return { label: "Awaiting Pickup", family: "warning" };
  }
  return { label: defaultLabel, family: ORDER_STATUS_FAMILY[status] ?? "neutral" };
}

export function StatusPill({
  label,
  family,
  expedited = false,
}: {
  label: string;
  family: StatusFamily;
  /** Expedited orders always render as `urgent`, overriding the status family. */
  expedited?: boolean;
}) {
  const effectiveFamily = expedited ? "urgent" : family;

  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] border px-[var(--space-4)] py-[var(--space-1)] text-[var(--text-xs)] font-medium"
      style={{
        background: `var(--status-${effectiveFamily}-bg)`,
        borderColor: `var(--status-${effectiveFamily}-border)`,
        color: `var(--status-${effectiveFamily}-text)`,
      }}
    >
      {label}
    </span>
  );
}
