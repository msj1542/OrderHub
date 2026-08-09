"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { can } from "@/lib/authz/policy";
import { WORK_ORDER_STATUS_LABELS, type AppUser, type OrderWorkOrderBrief } from "@/lib/db/schema";
import { StatusPill, type StatusFamily } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { acceptOrderAction } from "@/app/(app)/orders/actions";

function woStatusFamily(status: string): StatusFamily {
  if (status === "in_progress")                        return "info";
  if (status === "completed" || status === "released") return "success";
  if (status === "awaiting_pickup")                    return "warning";
  if (status === "canceled")                           return "danger";
  return "neutral";
}

export function WorkOrderSection({
  workOrder,
  user,
  orderId,
  orderStatus,
  canClaim,
}: {
  workOrder:   OrderWorkOrderBrief | null;
  user:        AppUser;
  orderId:     string;
  orderStatus: string;
  canClaim:    boolean;
}) {
  const router = useRouter();
  const [claiming, setClaiming] = React.useState(false);
  const [error, setError]       = React.useState<string | null>(null);

  if (!workOrder || !user.role.isInternal) return null;

  const canPrint   = can(user, "order:print_labels");
  const statusLabel =
    WORK_ORDER_STATUS_LABELS[workOrder.status as keyof typeof WORK_ORDER_STATUS_LABELS]
    ?? workOrder.status;
  const pct =
    workOrder.totalPieces > 0
      ? Math.round((workOrder.doneCount / workOrder.totalPieces) * 100)
      : 0;
  const showClaim = canClaim && (orderStatus === "accepted" || orderStatus === "in_fulfillment");

  async function handleClaim() {
    setClaiming(true);
    setError(null);
    const result = await acceptOrderAction(orderId, "claim");
    if (result?.error) {
      setError(result.error);
      setClaiming(false);
    } else {
      router.refresh();
    }
  }

  return (
    <section>
      <h3 className="text-[var(--text-base)] font-[var(--weight-semibold)] mb-[var(--space-3)]">
        Production
      </h3>
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-[var(--space-4)] flex flex-col gap-[var(--space-4)]">
        <div
          className="grid gap-x-[var(--space-6)] gap-y-[var(--space-3)] text-[var(--text-sm)]"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
        >
          <div>
            <p className="text-[var(--color-text-muted)] mb-[var(--space-1)]">Status</p>
            <StatusPill label={statusLabel} family={woStatusFamily(workOrder.status)} />
          </div>
          <div>
            <p className="text-[var(--color-text-muted)] mb-[var(--space-1)]">Assigned To</p>
            <p>{workOrder.claimedByName ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)] mb-[var(--space-1)]">Due</p>
            <p>{workOrder.dueDate ?? "—"}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)] mb-[var(--space-1)]">Pieces</p>
            <p>
              {workOrder.doneCount} / {workOrder.totalPieces} done
              {workOrder.totalPieces > 0 && (
                <span className="text-[var(--color-text-muted)]"> ({pct}%)</span>
              )}
            </p>
          </div>
        </div>

        {error && (
          <p className="text-[var(--text-sm)] text-[var(--status-danger-text)]">{error}</p>
        )}

        {(showClaim || canPrint) && (
          <div
            className="flex gap-[var(--space-2)] flex-wrap pt-[var(--space-3)] border-t"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            {showClaim && (
              <Button size="sm" onClick={handleClaim} disabled={claiming}>
                {claiming ? "Claiming…" : orderStatus === "accepted" ? "Claim" : "Continue Fulfillment"}
              </Button>
            )}
            {canPrint && (
              <>
                <a
                  href={`/api/production/${workOrder.id}/print?type=work-order`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] border text-[var(--text-sm)] transition-colors hover:bg-[var(--color-sunken)]"
                  style={{
                    borderColor: "var(--color-border-default)",
                    background:  "var(--color-panel)",
                    color:       "var(--color-text-primary)",
                  }}
                >
                  Print Work Order
                </a>
                <a
                  href={`/api/production/${workOrder.id}/print?type=labels`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] border text-[var(--text-sm)] transition-colors hover:bg-[var(--color-sunken)]"
                  style={{
                    borderColor: "var(--color-border-default)",
                    background:  "var(--color-panel)",
                    color:       "var(--color-text-primary)",
                  }}
                >
                  Print Labels
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
