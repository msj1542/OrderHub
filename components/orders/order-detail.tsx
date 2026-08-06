import { can } from "@/lib/authz/policy";
import { formatMoney } from "@/lib/pricing/money";
import { ORDER_STATUS_LABELS, type AppUser, type OrderFull } from "@/lib/db/schema";
import { ORDER_STATUS_FAMILY, StatusPill } from "@/components/ui/status-pill";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { CommentComposer } from "@/components/orders/comment-composer";
import { OrderActions } from "@/components/orders/order-actions";
import { WorkOrderSection } from "@/components/orders/work-order-section";

function formatDate(ts: string | Date | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function OrderDetail({ order, user }: { order: OrderFull; user: AppUser }) {
  const statusKey = order.status as keyof typeof ORDER_STATUS_LABELS;
  const family    = ORDER_STATUS_FAMILY[order.status] ?? "neutral";
  const canSeePrice = can(user, "pricing:view");
  const isInternal  = user.role.isInternal;

  return (
    <div className="flex flex-col gap-[var(--space-6)] p-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-[var(--space-4)]">
        <div>
          <h2 className="text-[var(--text-lg)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
            {order.orderNumber ?? "Draft"}
          </h2>
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-[var(--space-1)]">
            {order.companyName} · {order.createdByName}
          </p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          {order.isExpedited && <StatusPill label="Expedited" family="urgent" />}
          <StatusPill label={ORDER_STATUS_LABELS[statusKey] ?? order.status} family={family} />
        </div>
      </div>

      {/* Cancellation request banner */}
      {order.pendingCancellationRequest && (
        <Alert variant="warning">
          <strong>Cancellation requested</strong> by {order.pendingCancellationRequest.requestedByName}
          {order.pendingCancellationRequest.reason && (
            <> — "{order.pendingCancellationRequest.reason}"</>
          )}
        </Alert>
      )}

      {/* Actions */}
      <OrderActions
        order={order}
        canAccept={can(user, "order:accept")}
        canCancel={can(user, "order:cancel")}
        canDeclineCancel={can(user, "order:decline_cancel")}
        canRequestCancel={can(user, "order:request_cancel")}
        canDeleteDraft={can(user, "order:delete_draft")}
        canClose={can(user, "order:close")}
        canRelease={can(user, "order:release")}
        canQC={can(user, "order:qc")}
        canClaim={can(user, "order:claim")}
        canInvoice={can(user, "order:invoice_verify")}
        canCreate={can(user, "order:create")}
        isInternal={isInternal}
      />

      {/* Order info grid */}
      <div
        className="grid gap-x-[var(--space-6)] gap-y-[var(--space-4)] text-[var(--text-sm)]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
      >
        <div>
          <p className="text-[var(--color-text-muted)] mb-[var(--space-1)]">PO Number</p>
          <p>{order.poNumber || "—"}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-muted)] mb-[var(--space-1)]">Ordered</p>
          <p>{formatDate(order.submittedAt ?? order.createdAt)}</p>
        </div>
        {order.isExpedited && (
          <div>
            <p className="text-[var(--color-text-muted)] mb-[var(--space-1)]">Requested Date</p>
            <p>{formatDate(order.requestedDate)}</p>
          </div>
        )}
        <div>
          <p className="text-[var(--color-text-muted)] mb-[var(--space-1)]">Expected Completion</p>
          <p>{formatDate(order.expectedCompletionDate)}</p>
        </div>
        {isInternal && (
          <div>
            <p className="text-[var(--color-text-muted)] mb-[var(--space-1)]">Company</p>
            <p>{order.companyName}</p>
          </div>
        )}
      </div>

      {/* Line items */}
      <section>
        <h3 className="text-[var(--text-base)] font-[var(--weight-semibold)] mb-[var(--space-3)]">
          Items
        </h3>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] overflow-hidden">
          <table className="w-full text-[var(--text-sm)]">
            <thead>
              <tr className="bg-[var(--color-sunken)] border-b border-[var(--color-border-subtle)]">
                <th className="text-left px-[var(--space-4)] py-[var(--space-3)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Item</th>
                <th className="text-left px-[var(--space-4)] py-[var(--space-3)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Material</th>
                <th className="text-right px-[var(--space-4)] py-[var(--space-3)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Qty</th>
                {canSeePrice && <>
                  <th className="text-right px-[var(--space-4)] py-[var(--space-3)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Unit</th>
                  <th className="text-right px-[var(--space-4)] py-[var(--space-3)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Total</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                const attrs = line.attributesSnapshot ? JSON.parse(line.attributesSnapshot) : {};
                const label = line.isCustom
                  ? `${attrs.brand ?? ""} ${attrs.model ?? ""} ${attrs.year ?? ""} — ${attrs.coverageArea ?? ""}`
                  : `${line.skuSnapshot} — ${line.descriptionSnapshot}`;
                return (
                  <tr key={line.id} className="border-b border-[var(--color-border-subtle)] last:border-0">
                    <td className="px-[var(--space-4)] py-[var(--space-3)]">
                      <div className="flex items-center gap-[var(--space-2)]">
                        {line.isCustom && <Badge variant="warning">Custom</Badge>}
                        <span>{label}</span>
                      </div>
                      {line.pricingStatus === "pricing_pending" && (
                        <p className="text-[var(--text-xs)] text-[var(--status-warning-text)] mt-[var(--space-1)]">
                          Pricing pending review
                        </p>
                      )}
                    </td>
                    <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-text-muted)]">
                      {line.materialName ?? "—"}
                    </td>
                    <td className="px-[var(--space-4)] py-[var(--space-3)] text-right">{line.quantity}</td>
                    {canSeePrice && <>
                      <td className="px-[var(--space-4)] py-[var(--space-3)] text-right">
                        {formatMoney(line.unitPrice ? parseFloat(line.unitPrice) : null)}
                      </td>
                      <td className="px-[var(--space-4)] py-[var(--space-3)] text-right">
                        {formatMoney(line.lineTotal ? parseFloat(line.lineTotal) : null)}
                      </td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Totals */}
      {canSeePrice && (
        <div className="flex justify-end">
          <div className="text-[var(--text-sm)] space-y-[var(--space-2)] min-w-[200px]">
            <div className="flex justify-between gap-[var(--space-6)]">
              <span className="text-[var(--color-text-muted)]">Subtotal</span>
              <span>{formatMoney(parseFloat(order.subtotal))}</span>
            </div>
            {parseFloat(order.rushFee) > 0 && (
              <div className="flex justify-between gap-[var(--space-6)]">
                <span className="text-[var(--color-text-muted)]">Rush Fee</span>
                <span>{formatMoney(parseFloat(order.rushFee))}</span>
              </div>
            )}
            {parseFloat(order.adjustment) !== 0 && (
              <div className="flex justify-between gap-[var(--space-6)]">
                <span className="text-[var(--color-text-muted)]">Adjustment</span>
                <span>{formatMoney(parseFloat(order.adjustment))}</span>
              </div>
            )}
            <div className="flex justify-between gap-[var(--space-6)] border-t border-[var(--color-border-default)] pt-[var(--space-2)] font-[var(--weight-semibold)]">
              <span>Grand Total</span>
              <span>{formatMoney(parseFloat(order.grandTotal))}</span>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {(order.customerNotes || (isInternal && order.internalNotes)) && (
        <section className="flex flex-col gap-[var(--space-3)]">
          {order.customerNotes && (
            <div>
              <p className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-muted)] uppercase tracking-wide mb-[var(--space-1)]">Customer Notes</p>
              <p className="text-[var(--text-sm)] whitespace-pre-line">{order.customerNotes}</p>
            </div>
          )}
          {isInternal && order.internalNotes && (
            <div>
              <p className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-muted)] uppercase tracking-wide mb-[var(--space-1)]">Internal Notes</p>
              <p className="text-[var(--text-sm)] whitespace-pre-line">{order.internalNotes}</p>
            </div>
          )}
        </section>
      )}

      {/* Work Order (internal only) */}
      <WorkOrderSection workOrder={order.workOrder} user={user} />

      {/* Comments thread */}
      <section>
        <h3 className="text-[var(--text-base)] font-[var(--weight-semibold)] mb-[var(--space-3)]">
          Comments
        </h3>
        {order.comments.length === 0 && (
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">No comments yet.</p>
        )}
        <div className="flex flex-col gap-[var(--space-4)] mb-[var(--space-4)]">
          {order.comments.map((comment) => (
            <div
              key={comment.id}
              className="flex flex-col gap-[var(--space-1)]"
            >
              <div className="flex items-center gap-[var(--space-3)]">
                <span className="text-[var(--text-sm)] font-[var(--weight-medium)]">{comment.authorName}</span>
                {comment.isInternal && (
                  <Badge variant="neutral">Internal</Badge>
                )}
                <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                  {new Date(comment.createdAt).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-[var(--text-sm)] whitespace-pre-line pl-0">{comment.body}</p>
            </div>
          ))}
        </div>
        {(can(user, "order:comment_customer") || can(user, "order:comment_internal")) && (
          <CommentComposer
            orderId={order.id}
            canInternal={can(user, "order:comment_internal")}
          />
        )}
      </section>
    </div>
  );
}
