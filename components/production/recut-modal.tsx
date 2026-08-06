"use client";

import * as React from "react";
import { Button }   from "@/components/ui/button";
import { Label }    from "@/components/ui/label";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { WorkOrderLineFull } from "@/lib/db/schema";

type Props = {
  open:        boolean;
  lines:       WorkOrderLineFull[];
  onClose:     () => void;
  onSubmit:    (orderLineId: string, quantity: number, reason: string) => Promise<void>;
};

export function RecutModal({ open, lines, onClose, onSubmit }: Props) {
  const [lineId,   setLineId]   = React.useState(lines[0]?.id ?? "");
  const [quantity, setQuantity] = React.useState(1);
  const [reason,   setReason]   = React.useState("");
  const [busy,     setBusy]     = React.useState(false);
  const [error,    setError]    = React.useState<string | null>(null);

  const selectedLine = lines.find((l) => l.id === lineId);
  const patternIn    = selectedLine ? parseFloat(selectedLine.patternLengthIn ?? "0") : 0;
  const estimatedIn  = selectedLine ? (patternIn + 1) * quantity : 0;

  React.useEffect(() => {
    if (open) {
      setLineId(lines[0]?.id ?? "");
      setQuantity(1);
      setReason("");
      setError(null);
    }
  }, [open, lines]);

  async function handleSubmit() {
    if (!selectedLine || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(lineId, quantity, reason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record recut.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent style={{ maxWidth: "480px" }}>
        <DialogHeader>
          <DialogTitle>Record Non-Billable Re-cut</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--space-4)] py-[var(--space-2)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <Label htmlFor="recut-line">Line Item</Label>
            <select
              id="recut-line"
              value={lineId}
              onChange={(e) => { setLineId(e.target.value); setQuantity(1); }}
              className="w-full rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] bg-[var(--color-panel)]"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              {lines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.skuSnapshot} — {line.materialName ?? "?"} × {line.quantity}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-[var(--space-2)]">
            <Label htmlFor="recut-qty">Quantity</Label>
            <Input
              id="recut-qty"
              type="number"
              min={1}
              max={selectedLine?.quantity ?? 1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
            {selectedLine && (
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                Max: {selectedLine.quantity} · Est. material usage: {estimatedIn.toFixed(1)} in.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-[var(--space-2)]">
            <Label htmlFor="recut-reason">Reason</Label>
            <Textarea
              id="recut-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this re-cut is needed…"
            />
          </div>

          {error && (
            <p className="text-[var(--text-sm)] text-[var(--status-danger-text)]">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedLine || !reason.trim() || busy}
          >
            {busy ? "Recording…" : "Record Re-cut"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
