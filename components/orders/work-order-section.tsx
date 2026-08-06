import { can } from "@/lib/authz/policy";
import { WORK_ORDER_STATUS_LABELS, type AppUser, type OrderWorkOrderBrief } from "@/lib/db/schema";
import { StatusPill, type StatusFamily } from "@/components/ui/status-pill";

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
}: {
  workOrder: OrderWorkOrderBrief | null;
  user:      AppUser;
}) {
  if (!workOrder || !user.role.isInternal) return null;

  const canPrint   = can(user, "order:print_labels");
  const statusLabel =
    WORK_ORDER_STATUS_LABELS[workOrder.status as keyof typeof WORK_ORDER_STATUS_LABELS]
    ?? workOrder.status;
  const pct =
    workOrder.totalPieces > 0
      ? Math.round((workOrder.doneCount / workOrder.totalPieces) * 100)
      : 0;

  return (
    <section>
      <h3 className="text-[var(--text-base)] font-[var(--weight-semibold)] mb-[var(--space-3)]">
        Production
      </h3>
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-[var(--space-4)] flex flex-col gap-[var(--space-4)]">
        <div
          className="grid gap-x-[var(--space-6)] gap-y-[var(--space-3)] text-[var(--text-sm)]"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
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

        {canPrint && (
          <div
            className="flex gap-[var(--space-2)] flex-wrap pt-[var(--space-3)] border-t"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
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
          </div>
        )}
      </div>
    </section>
  );
}
