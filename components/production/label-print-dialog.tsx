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
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (open) {
      setSelected(new Set(lines.map((l) => l.id)));
      setQuantities(Object.fromEntries(lines.map((l) => [l.id, l.quantity])));
    }
  }, [open, lines]);

  const allSelected = selected.size === lines.length;
  const qtyFor = (line: Line) => quantities[line.id] ?? line.quantity;
  const totalLabels = lines.filter((l) => selected.has(l.id)).reduce((s, l) => s + qtyFor(l), 0);

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

  function setQuantity(line: Line, value: number) {
    const clamped = Math.min(line.quantity, Math.max(1, Math.round(value) || 1));
    setQuantities((prev) => ({ ...prev, [line.id]: clamped }));
  }

  function handlePrint() {
    const isDefaultFull = allSelected && lines.every((l) => qtyFor(l) === l.quantity);
    const linesParam = isDefaultFull
      ? ""
      : `&lines=${[...selected].map((id) => `${id}:${quantities[id] ?? lines.find((l) => l.id === id)!.quantity}`).join(",")}`;
    const url = `/api/production/${workOrderId}/print?type=labels${linesParam}`;
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
          {lines.map((line) => {
            const isSelected = selected.has(line.id);
            return (
              <div key={line.id} className="flex items-center gap-[var(--space-2)] text-[var(--text-sm)]">
                <label className="flex items-center gap-[var(--space-2)] cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(line.id)}
                    style={{ accentColor: "var(--color-brand)" }}
                  />
                  <span className="min-w-0 truncate">{line.skuSnapshot}</span>
                  <span className="text-[var(--color-text-muted)] truncate">{line.materialName ?? ""}</span>
                </label>
                {isSelected ? (
                  <input
                    type="number"
                    min={1}
                    max={line.quantity}
                    value={qtyFor(line)}
                    onChange={(e) => setQuantity(line, Number(e.target.value))}
                    className="shrink-0"
                    style={{
                      width: "56px",
                      padding: "2px 6px",
                      border: "1px solid var(--color-border-default)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--color-panel)",
                      color: "var(--color-text-primary)",
                    }}
                  />
                ) : (
                  <span className="shrink-0 text-[var(--color-text-muted)]">× {line.quantity}</span>
                )}
              </div>
            );
          })}
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
