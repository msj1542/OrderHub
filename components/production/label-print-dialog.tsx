"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Line = { id: string; skuSnapshot: string; materialName: string | null; quantity: number };

type Props = {
  open: boolean;
  onClose: () => void;
  workOrderId: string;
  lines: Line[];
};

export function LabelPrintDialog({ open, onClose, workOrderId, lines }: Props) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(lines.map((l) => l.id)));

  React.useEffect(() => {
    if (open) setSelected(new Set(lines.map((l) => l.id)));
  }, [open, lines]);

  const allSelected = selected.size === lines.length;
  const totalLabels = lines.filter((l) => selected.has(l.id)).reduce((s, l) => s + l.quantity, 0);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(lines.map((l) => l.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePrint() {
    const lineIds = [...selected].join(",");
    const url = `/api/production/${workOrderId}/print?type=labels${selected.size < lines.length ? `&lines=${lineIds}` : ""}`;
    window.open(url, "_blank");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent style={{ maxWidth: "480px" }}>
        <DialogHeader>
          <DialogTitle>Print Labels</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-[var(--space-3)] py-[var(--space-2)]">
          <label className="flex items-center gap-[var(--space-2)] cursor-pointer text-[var(--text-sm)] font-[var(--weight-semibold)]">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: "var(--color-brand)" }} />
            Select all ({lines.length} items, {lines.reduce((s, l) => s + l.quantity, 0)} labels)
          </label>
          <div className="border-t" style={{ borderColor: "var(--color-border-subtle)" }} />
          {lines.map((line) => (
            <label key={line.id} className="flex items-center gap-[var(--space-2)] cursor-pointer text-[var(--text-sm)]">
              <input
                type="checkbox"
                checked={selected.has(line.id)}
                onChange={() => toggle(line.id)}
                style={{ accentColor: "var(--color-brand)" }}
              />
              <span className="flex-1 min-w-0 truncate">{line.skuSnapshot}</span>
              <span className="text-[var(--color-text-muted)]">{line.materialName ?? ""}</span>
              <span className="text-[var(--color-text-muted)]">× {line.quantity}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={selected.size === 0} onClick={handlePrint}>
            Print {totalLabels} Label{totalLabels !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
