"use client";

import * as React from "react";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Textarea }  from "@/components/ui/textarea";
import { Label }     from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/pricing/money";
import type { OrderFull } from "@/lib/db/schema";

type Props = {
  open:    boolean;
  order:   OrderFull;
  onClose: () => void;
  onSubmit: (input: {
    invoiceNumber: string;
    invoiceUrl: string;
    hasDiscrepancy: boolean;
    discrepancyReason: string;
    attested: boolean;
  }) => Promise<void>;
};

export function InvoiceVerifyModal({ open, order, onClose, onSubmit }: Props) {
  const grandTotal = parseFloat(order.grandTotal);

  const [invoiceNumber, setInvoiceNumber]         = React.useState("");
  const [invoiceUrl, setInvoiceUrl]               = React.useState("");
  const [hasDiscrepancy, setHasDiscrepancy]       = React.useState(false);
  const [discrepancyReason, setDiscrepancyReason] = React.useState("");
  const [attested, setAttested]                   = React.useState(false);
  const [busy, setBusy]                           = React.useState(false);
  const [error, setError]                         = React.useState<string | null>(null);

  const canAttest =
    invoiceNumber.trim().length > 0 &&
    (!hasDiscrepancy || discrepancyReason.trim().length > 0);

  function reset() {
    setInvoiceNumber("");
    setInvoiceUrl("");
    setHasDiscrepancy(false);
    setDiscrepancyReason("");
    setAttested(false);
    setError(null);
  }

  async function handleSubmit() {
    if (!canAttest || !attested) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        invoiceNumber,
        invoiceUrl,
        hasDiscrepancy,
        discrepancyReason,
        attested,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent style={{ maxWidth: "560px" }}>
        <DialogHeader>
          <DialogTitle>
            Invoice Verification{order.orderNumber ? ` — ${order.orderNumber}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--space-4)] py-[var(--space-2)]">
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            Compare the external invoice against these order lines before releasing.
          </p>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] overflow-hidden">
            <table className="w-full text-[var(--text-sm)]">
              <thead>
                <tr className="bg-[var(--color-sunken)] border-b border-[var(--color-border-subtle)]">
                  <th className="text-left px-[var(--space-3)] py-[var(--space-2)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Item</th>
                  <th className="text-right px-[var(--space-3)] py-[var(--space-2)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Qty</th>
                  <th className="text-right px-[var(--space-3)] py-[var(--space-2)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.id} className="border-b border-[var(--color-border-subtle)] last:border-0">
                    <td className="px-[var(--space-3)] py-[var(--space-2)]">{line.skuSnapshot}</td>
                    <td className="px-[var(--space-3)] py-[var(--space-2)] text-right">{line.quantity}</td>
                    <td className="px-[var(--space-3)] py-[var(--space-2)] text-right">
                      {formatMoney(line.lineTotal ? parseFloat(line.lineTotal) : null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            <div className="flex flex-col gap-[var(--space-2)]">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-10234"
              />
            </div>
            <div className="flex flex-col gap-[var(--space-2)]">
              <Label htmlFor="expectedInvoiceTotal">Expected Invoice Total</Label>
              <div
                id="expectedInvoiceTotal"
                className="flex items-center h-9 px-[var(--space-3)] rounded-[var(--radius-md)] text-[var(--text-lg)] font-[var(--weight-bold)]"
                style={{ background: "var(--color-sunken)" }}
              >
                {formatMoney(grandTotal)}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[var(--space-2)]">
            <Label htmlFor="invoiceUrl">
              Invoice URL <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
            </Label>
            <Input
              id="invoiceUrl"
              type="url"
              value={invoiceUrl}
              onChange={(e) => setInvoiceUrl(e.target.value)}
              placeholder="https://…"
              disabled={!invoiceNumber.trim()}
            />
            {!invoiceNumber.trim() && (
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                Enter the invoice number first.
              </p>
            )}
          </div>

          <label className="flex items-center gap-[var(--space-2)] cursor-pointer select-none text-[var(--text-sm)]">
            <input
              type="checkbox"
              checked={hasDiscrepancy}
              onChange={() => setHasDiscrepancy((v) => !v)}
              style={{ accentColor: "var(--color-brand)" }}
            />
            This invoice's total differs from the expected total above
          </label>

          {hasDiscrepancy && (
            <div className="flex flex-col gap-[var(--space-2)]">
              <Label htmlFor="discrepancyReason">
                Describe the discrepancy <span className="text-[var(--status-danger-text)]">(required)</span>
              </Label>
              <Textarea
                id="discrepancyReason"
                rows={2}
                value={discrepancyReason}
                onChange={(e) => setDiscrepancyReason(e.target.value)}
                placeholder="Explain the mismatch…"
              />
            </div>
          )}

          <div className="border-t pt-[var(--space-3)]" style={{ borderColor: "var(--color-border-subtle)" }}>
            <label
              className="flex items-start gap-[var(--space-3)] cursor-pointer select-none"
              style={{ opacity: canAttest ? 1 : 0.45 }}
            >
              <input
                type="checkbox"
                checked={attested}
                disabled={!canAttest}
                onChange={() => setAttested((v) => !v)}
                className="mt-[2px] shrink-0"
                style={{ accentColor: "var(--color-brand)" }}
              />
              <span className="text-[var(--text-sm)] font-[var(--weight-medium)]">
                I have compared this invoice against the order lines above, and confirmed the total
                {hasDiscrepancy ? " with the discrepancy documented." : " matches the expected amount."}
              </span>
            </label>
          </div>

          {error && (
            <p className="text-[var(--text-sm)] text-[var(--status-danger-text)]">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => { reset(); onClose(); }} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canAttest || !attested || busy}>
            {busy ? "Verifying…" : "Order Verified & Ready for Pickup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
