"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InvoiceVerifyModal } from "@/components/orders/invoice-verify-modal";
import {
  acceptOrderAction,
  cancelOrderAction,
  requestCancellationAction,
  declineCancellationAction,
  deleteDraftAction,
  submitDraftAction,
  invoiceVerifyAction,
} from "@/app/(app)/orders/actions";
import type { OrderFull } from "@/lib/db/schema";

const NOT_REORDERABLE: string[] = ["draft", "canceled"];
const SUPPLEMENTAL_ELIGIBLE: string[] = [
  "accepted", "in_fulfillment", "fulfillment_completed",
];

type Props = {
  order:        OrderFull;
  canAccept:    boolean;
  canCancel:    boolean;
  canDeclineCancel: boolean;
  canRequestCancel: boolean;
  canDeleteDraft: boolean;
  canSubmit:    boolean;
  canRelease:   boolean;
  canQC:        boolean;
  canClaim:     boolean;
  canInvoice:   boolean;
  canCreate:    boolean;
  isInternal:   boolean;
};

export function OrderActions({
  order,
  canAccept,
  canCancel,
  canDeclineCancel,
  canRequestCancel,
  canDeleteDraft,
  canSubmit,
  canRelease,
  canQC,
  canClaim,
  canInvoice,
  canCreate,
  isInternal,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<string | null>(null);
  const [reason, setReason]   = React.useState("");
  const [expectedDate, setExpectedDate] = React.useState(order.expectedCompletionDate ?? "");
  const [error, setError]     = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function run(action: () => Promise<{ error?: string | null; message?: string } | undefined | void>) {
    setError(null);
    setMessage(null);
    const result = await action();
    if (result && "error" in result && result.error) {
      setError(result.error);
    } else {
      setDialog(null);
      setReason("");
      if (result && "message" in result && result.message) {
        setMessage(result.message);
      } else {
        router.refresh();
      }
    }
  }

  const status = order.status;
  const hasCancelRequest = order.cancellationRequested;

  return (
    <div className="flex flex-wrap gap-[var(--space-3)] items-center">
      {error && (
        <p className="w-full text-[var(--text-sm)] text-[var(--status-danger-text)]">{error}</p>
      )}
      {message && (
        <p className="w-full text-[var(--text-sm)] text-[var(--status-info-text)]">{message}</p>
      )}

      {/* Accept */}
      {canAccept && status === "submitted" && (
        <Button size="sm" onClick={() => setDialog("accept")}>Accept Order</Button>
      )}

      {/* Claim / Start fulfillment */}
      {canClaim && (status === "accepted" || status === "in_fulfillment") && (
        <Button size="sm" onClick={() => run(() => acceptOrderAction(order.id, "claim"))}>
          {status === "accepted" ? "Claim" : "Continue Fulfillment"}
        </Button>
      )}

      {/* Invoice verification */}
      {canInvoice && status === "fulfillment_completed" && (
        <Button size="sm" onClick={() => setDialog("invoice_verify")}>Verify Invoice</Button>
      )}

      {/* Release */}
      {canRelease && status === "ready_for_pickup" && (
        <Button size="sm" onClick={() => setDialog("release")}>Release Order</Button>
      )}

      {/* Cancel order (internal) */}
      {canCancel && (status === "submitted" || status === "accepted") && (
        <Button size="sm" variant="danger" onClick={() => setDialog("cancel")}>Cancel Order</Button>
      )}

      {/* Decline cancellation */}
      {canDeclineCancel && hasCancelRequest && (
        <Button size="sm" variant="secondary" onClick={() => setDialog("decline_cancel")}>
          Decline Cancellation Request
        </Button>
      )}

      {/* Request cancellation (external) */}
      {canRequestCancel && !hasCancelRequest && (status === "submitted" || status === "accepted") && (
        <Button size="sm" variant="secondary" onClick={() => setDialog("request_cancel")}>
          Request Cancellation
        </Button>
      )}

      {/* Submit draft */}
      {canSubmit && status === "draft" && (
        <Button size="sm" onClick={() => run(() => submitDraftAction(order.id))}>
          Submit Order
        </Button>
      )}

      {/* Delete draft */}
      {canDeleteDraft && status === "draft" && (
        <Button size="sm" variant="danger" onClick={() => setDialog("delete_draft")}>
          Delete Draft
        </Button>
      )}

      {/* Reorder — external users only see this after accepted */}
      {canCreate && !NOT_REORDERABLE.includes(status) && (isInternal || !["submitted"].includes(status)) && (
        <Button size="sm" variant="secondary" onClick={() => router.push(`/orders/new?reorder_from=${order.id}`)}>
          Reorder
        </Button>
      )}

      {/* Add supplemental order */}
      {canCreate && isInternal && !order.supplementalToOrderId && SUPPLEMENTAL_ELIGIBLE.includes(status) && (
        <Button size="sm" variant="secondary" onClick={() => router.push(`/orders/new?supplemental_to=${order.id}`)}>
          Add Supplemental Order
        </Button>
      )}

      {/* ── Dialogs ── */}

      <InvoiceVerifyModal
        open={dialog === "invoice_verify"}
        order={order}
        onClose={() => setDialog(null)}
        onSubmit={async (input) => {
          const result = await invoiceVerifyAction(order.id, input);
          if (result?.error) throw new Error(result.error);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={dialog === "accept"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title="Accept Order"
        description="Confirm the expected completion date before accepting."
        confirmLabel="Accept"
        variant="primary"
        onConfirm={() => run(() => acceptOrderAction(order.id, "accept", expectedDate))}
      >
        <div className="flex flex-col gap-[var(--space-3)]">
          {order.isExpedited && (
            <div className="rounded-[var(--radius-md)] bg-[var(--status-urgent-bg)] border border-[var(--status-urgent-border)] px-[var(--space-4)] py-[var(--space-3)]">
              <p className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--status-urgent-text)]">
                Expedited Order
              </p>
              {order.requestedDate && (
                <p className="text-[var(--text-sm)] text-[var(--status-urgent-text)] mt-[var(--space-1)]">
                  Requested date: {new Date(order.requestedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          )}
          <Label htmlFor="expectedDate">Expected Completion Date</Label>
          <Input
            id="expectedDate"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title="Cancel Order"
        description="This will cancel the order and notify the customer. A reason is required."
        confirmLabel="Cancel Order"
        variant="danger"
        onConfirm={() => run(() => cancelOrderAction(order.id, reason))}
      >
        <div className="flex flex-col gap-[var(--space-3)]">
          <Label htmlFor="cancelReason">Reason</Label>
          <Textarea id="cancelReason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for cancellation…" />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "request_cancel"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title="Request Cancellation"
        description="A coordinator will review your request. A reason is required."
        confirmLabel="Submit Request"
        variant="danger"
        onConfirm={() => run(() => requestCancellationAction(order.id, reason))}
      >
        <div className="flex flex-col gap-[var(--space-3)]">
          <Label htmlFor="reqReason">Reason</Label>
          <Textarea id="reqReason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you need to cancel this order?…" />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "decline_cancel"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title="Decline Cancellation Request"
        description="The order will remain active. You may optionally explain why the request was declined."
        confirmLabel="Decline Request"
        variant="primary"
        onConfirm={() => run(() => declineCancellationAction(order.id, reason))}
      >
        <div className="flex flex-col gap-[var(--space-3)]">
          <Label htmlFor="declineReason">Reason (optional)</Label>
          <Textarea id="declineReason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explanation for customer…" />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "release"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title="Release Order"
        description="Release this order to the customer and close it."
        confirmLabel="Release"
        variant="primary"
        onConfirm={() => run(() => acceptOrderAction(order.id, "release"))}
      />

      <ConfirmDialog
        open={dialog === "delete_draft"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title="Delete Draft"
        description="This draft will be permanently deleted. This cannot be undone."
        confirmLabel="Delete Draft"
        variant="danger"
        onConfirm={async () => {
          await deleteDraftAction(order.id);
          router.push("/orders");
        }}
      />
    </div>
  );
}
