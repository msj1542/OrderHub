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
