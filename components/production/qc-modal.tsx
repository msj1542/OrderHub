"use client";

import * as React from "react";
import { Button }    from "@/components/ui/button";
import { Textarea }  from "@/components/ui/textarea";
import { Label }     from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { QC_ITEMS } from "@/lib/production/service";

type Props = {
  open:          boolean;
  workOrderId:   string;
  orderNumber:   string | null;
  onClose:       () => void;
  onSubmit:      (answers: Record<string, boolean>, notes: string | null) => Promise<void>;
};

export function QcModal({ open, workOrderId: _workOrderId, orderNumber, onClose, onSubmit }: Props) {
  const [answers, setAnswers]   = React.useState<Record<string, boolean>>({});
  const [attested, setAttested] = React.useState(false);
  const [notes, setNotes]       = React.useState("");
  const [busy, setBusy]         = React.useState(false);
  const [error, setError]       = React.useState<string | null>(null);

  const allChecked = QC_ITEMS.every(([key]) => answers[key] === true);

  function toggle(key: string) {
    setAnswers((prev) => ({ ...prev, [key]: !prev[key] }));
    if (attested) setAttested(false);
  }

  async function handleSubmit() {
    if (!allChecked || !attested) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(answers, notes.trim() || null);
      setAnswers({});
      setAttested(false);
      setNotes("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit QC.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent style={{ maxWidth: "520px" }}>
        <DialogHeader>
          <DialogTitle>
            Finalize Production{orderNumber ? ` — WO-${orderNumber}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--space-4)] py-[var(--space-2)]">
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            Check each item to confirm it meets quality standards before finalizing.
          </p>

          {QC_ITEMS.map(([key, label]) => (
            <label
              key={key}
              className="flex items-start gap-[var(--space-3)] cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={answers[key] === true}
                onChange={() => toggle(key)}
                className="mt-[2px] shrink-0"
                style={{ accentColor: "var(--color-brand)" }}
              />
              <span className="text-[var(--text-sm)]">{label}</span>
            </label>
          ))}

          <div
            className="border-t pt-[var(--space-3)]"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <label
              className="flex items-start gap-[var(--space-3)] cursor-pointer select-none"
              style={{ opacity: allChecked ? 1 : 0.45 }}
            >
              <input
                type="checkbox"
                checked={attested}
                disabled={!allChecked}
                onChange={() => setAttested((v) => !v)}
                className="mt-[2px] shrink-0"
                style={{ accentColor: "var(--color-brand)" }}
              />
              <span className="text-[var(--text-sm)] font-[var(--weight-medium)]">
                I attest that all quality standards have been met and this order is ready for pickup.
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-[var(--space-2)]">
            <Label htmlFor="qc-notes">Notes (optional)</Label>
            <Textarea
              id="qc-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations or notes about this order…"
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
            disabled={!allChecked || !attested || busy}
          >
            {busy ? "Finalizing…" : "Finalize Production"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
