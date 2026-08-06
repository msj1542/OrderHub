"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { QcModal }     from "@/components/production/qc-modal";
import { RecutModal }  from "@/components/production/recut-modal";
import { createClient } from "@/lib/supabase/client";
import {
  claimWorkOrderAction,
  updatePieceProgressAction,
  recordRecutAction,
  submitQCAction,
} from "@/app/(app)/production/actions";
import type { WorkOrderSummary, WorkOrderLineFull, WorkOrderFull } from "@/lib/db/schema";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/db/schema";

// ── Tab config ─────────────────────────────────────────────────

const TABS = [
  { key: "current",   label: "Current Work"          },
  { key: "completed", label: "Completed / On Site"   },
  { key: "archived",  label: "Released / Archived"   },
  { key: "all",       label: "All"                   },
] as const;

type Tab = typeof TABS[number]["key"];

// ── Piece tally ────────────────────────────────────────────────

function PieceTally({
  lineId,
  workOrderId,
  quantity,
  initialDone,
  canManage,
  onUpdate,
}: {
  lineId:      string;
  workOrderId: string;
  quantity:    number;
  initialDone: number[];
  canManage:   boolean;
  onUpdate:    (lineId: string, pieces: number[]) => void;
}) {
  const [done, setDone] = React.useState<Set<number>>(() => new Set(initialDone));
  const [saving, setSaving] = React.useState(false);

  async function toggle(piece: number) {
    if (!canManage || saving) return;
    const next = new Set(done);
    if (next.has(piece)) next.delete(piece);
    else next.add(piece);
    setDone(next);
    setSaving(true);
    const arr = [...next].sort((a, b) => a - b);
    await updatePieceProgressAction(workOrderId, lineId, arr);
    onUpdate(lineId, arr);
    setSaving(false);
  }

  const pieces = Array.from({ length: quantity }, (_, i) => i + 1);

  // Individual view for ≤45 pieces; batch-of-5 view for >45
  if (quantity <= 45) {
    return (
      <div className="flex flex-wrap gap-[var(--space-1)]">
        {pieces.map((p) => (
          <button
            key={p}
            onClick={() => toggle(p)}
            disabled={!canManage || saving}
            title={`Piece ${p}`}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid",
              borderColor: done.has(p) ? "var(--color-brand)" : "var(--color-border-default)",
              background:  done.has(p) ? "var(--color-brand)" : "var(--color-panel)",
              color:       done.has(p) ? "var(--color-brand-fg)" : "var(--color-text-muted)",
              fontSize:    "var(--text-xs)",
              fontWeight:  "var(--weight-medium)",
              cursor:      canManage ? "pointer" : "default",
              transition:  "background 0.12s, border-color 0.12s",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    );
  }

  // Batch view: groups of 5
  const batches: [number, number][] = [];
  for (let start = 1; start <= quantity; start += 5) {
    batches.push([start, Math.min(start + 4, quantity)]);
  }

  function isBatchDone(start: number, end: number) {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i).every((p) => done.has(p));
  }

  async function toggleBatch(start: number, end: number) {
    if (!canManage || saving) return;
    const batch = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const allDone = batch.every((p) => done.has(p));
    const next = new Set(done);
    if (allDone) batch.forEach((p) => next.delete(p));
    else batch.forEach((p) => next.add(p));
    setDone(next);
    setSaving(true);
    const arr = [...next].sort((a, b) => a - b);
    await updatePieceProgressAction(workOrderId, lineId, arr);
    onUpdate(lineId, arr);
    setSaving(false);
  }

  return (
    <div className="flex flex-wrap gap-[var(--space-1)]">
      {batches.map(([start, end]) => {
        const isDone = isBatchDone(start, end);
        return (
          <button
            key={start}
            onClick={() => toggleBatch(start, end)}
            disabled={!canManage || saving}
            title={`Pieces ${start}–${end}`}
            style={{
              padding:    "2px 6px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid",
              borderColor: isDone ? "var(--color-brand)" : "var(--color-border-default)",
              background:  isDone ? "var(--color-brand)" : "var(--color-panel)",
              color:       isDone ? "var(--color-brand-fg)" : "var(--color-text-muted)",
              fontSize:    "var(--text-xs)",
              cursor:      canManage ? "pointer" : "default",
              transition:  "background 0.12s, border-color 0.12s",
            }}
          >
            {start}–{end}
          </button>
        );
      })}
    </div>
  );
}

// ── Roll group calculation ─────────────────────────────────────

type RollGroup = {
  key:              string;
  materialName:     string | null;
  rollWidthIn:      string | null;
  rollLengthFt:     string | null;
  totalLinearFt:    number;
};

function computeRollGroups(lines: WorkOrderLineFull[]): RollGroup[] {
  const groups = new Map<string, RollGroup>();
  for (const line of lines) {
    const key = `${line.materialName ?? "?"}|${line.requiredRollWidthIn ?? "?"}`;
    const existing = groups.get(key);
    const patternIn = parseFloat(line.patternLengthIn ?? "0");
    const lineFt    = (patternIn / 12) * line.quantity;
    if (existing) {
      existing.totalLinearFt += lineFt;
    } else {
      groups.set(key, {
        key,
        materialName:  line.materialName,
        rollWidthIn:   line.requiredRollWidthIn,
        rollLengthFt:  null,
        totalLinearFt: lineFt,
      });
    }
  }
  return [...groups.values()];
}

// ── Expanded detail ────────────────────────────────────────────

function WorkOrderDetail({
  woId,
  canManage,
  canQC,
  onNeedData,
}: {
  woId:      string;
  canManage: boolean;
  canQC:     boolean;
  onNeedData: (woId: string) => WorkOrderFull | null;
}) {
  const wo = onNeedData(woId);
  if (!wo) return <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] p-[var(--space-4)]">Loading…</p>;

  return (
    <div className="text-[var(--text-sm)] text-[var(--color-text-primary)]">
      {wo.lines.map((line) => (
        <div key={line.id} className="mb-[var(--space-4)]">
          <div className="flex items-baseline gap-[var(--space-2)] mb-[var(--space-2)]">
            <span className="font-[var(--weight-medium)]">{line.skuSnapshot}</span>
            {line.materialName && (
              <span className="text-[var(--color-text-muted)]">· {line.materialName}</span>
            )}
            <span className="text-[var(--color-text-muted)]">
              · qty {line.quantity} ·{" "}
              <span style={{ color: "var(--color-brand)" }}>
                {line.progress?.completedPieces.length ?? 0}/{line.quantity} done
              </span>
            </span>
          </div>
          <PieceTally
            lineId={line.id}
            workOrderId={wo.id}
            quantity={line.quantity}
            initialDone={line.progress?.completedPieces ?? []}
            canManage={canManage}
            onUpdate={() => {}}
          />
          {line.recuts.length > 0 && (
            <div className="mt-[var(--space-2)]">
              <p className="text-[var(--color-text-muted)]">
                Re-cuts: {line.recuts.map((r, i) => (
                  <span key={r.id}>
                    {i > 0 && ", "}
                    ×{r.quantity} ({r.reason}
                    {r.materialUsageInches ? `, ${parseFloat(r.materialUsageInches).toFixed(1)} in.` : ""})
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

type Props = {
  workOrders: WorkOrderSummary[];
  activeTab:  Tab;
  canManage:  boolean;
  canQC:      boolean;
  canClaim:   boolean;
  canPrint:   boolean;
};

export function ProductionQueue({
  workOrders,
  activeTab,
  canManage,
  canQC,
  canClaim,
  canPrint,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [fullData, setFullData]     = React.useState<Map<string, WorkOrderFull>>(new Map());
  const [qcModalWoId, setQcModalWoId]     = React.useState<string | null>(null);
  const [recutModalWoId, setRecutModalWoId] = React.useState<string | null>(null);
  const [actionError, setActionError]       = React.useState<string | null>(null);

  function switchTab(tab: Tab) {
    const params = new URLSearchParams({ tab });
    router.push(`${pathname}?${params.toString()}`);
  }

  // Live updates: another user claiming/completing a work order or ticking a
  // piece off elsewhere refreshes this view without a manual reload. RLS on
  // both tables (see 0006_phase6.sql) already restricts delivery to internal
  // staff — the only role that ever renders this page.
  React.useEffect(() => {
    const supabase = createClient();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel("production-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "production_work_orders" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "production_line_progress" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [router]);

  async function handleExpand(woId: string) {
    if (expandedId === woId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(woId);
    // Fetch full detail if we don't have it yet
    if (!fullData.has(woId)) {
      const res = await fetch(`/api/production/${woId}/detail`);
      if (res.ok) {
        const data: WorkOrderFull = await res.json();
        setFullData((m) => new Map(m).set(woId, data));
      }
    }
  }

  function getFullWo(woId: string): WorkOrderFull | null {
    return fullData.get(woId) ?? null;
  }

  async function handleClaim(woId: string) {
    setActionError(null);
    const res = await claimWorkOrderAction(woId);
    if (res.error) setActionError(res.error);
    else router.refresh();
  }

  async function handleQCSubmit(answers: Record<string, boolean>, notes: string | null) {
    if (!qcModalWoId) return;
    const res = await submitQCAction(qcModalWoId, answers, notes);
    if (res.error) throw new Error(res.error);
    setQcModalWoId(null);
    router.refresh();
  }

  async function handleRecutSubmit(orderLineId: string, quantity: number, reason: string) {
    if (!recutModalWoId) return;
    const res = await recordRecutAction(recutModalWoId, orderLineId, quantity, reason);
    if (res.error) throw new Error(res.error);
    setRecutModalWoId(null);
    router.refresh();
  }

  const qcWo     = qcModalWoId    ? workOrders.find((w) => w.id === qcModalWoId)    : null;
  const recutWo  = recutModalWoId ? workOrders.find((w) => w.id === recutModalWoId) : null;
  const recutFull = recutModalWoId ? getFullWo(recutModalWoId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-[var(--space-6)] py-[var(--space-4)] border-b"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <h1 className="text-[var(--text-xl)] font-[var(--weight-semibold)]">Production Queue</h1>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-0 border-b px-[var(--space-6)]"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] border-b-2 transition-colors"
            style={{
              borderBottomColor: activeTab === tab.key ? "var(--color-brand)" : "transparent",
              color:             activeTab === tab.key ? "var(--color-brand)"  : "var(--color-text-muted)",
              fontWeight:        activeTab === tab.key ? "var(--weight-medium)" : undefined,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {actionError && (
        <div
          className="mx-[var(--space-6)] mt-[var(--space-4)] px-[var(--space-4)] py-[var(--space-3)] rounded-[var(--radius-md)] text-[var(--text-sm)]"
          style={{
            background: "var(--status-danger-bg)",
            color:      "var(--status-danger-text)",
            border:     "1px solid var(--status-danger-border)",
          }}
        >
          {actionError}
        </div>
      )}

      {/* Work order list */}
      <div className="flex-1 overflow-auto p-[var(--space-6)]">
        {workOrders.length === 0 ? (
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            No work orders in this view.
          </p>
        ) : (
          <div className="flex flex-col gap-[var(--space-3)]">
            {workOrders.map((wo) => {
              const isExpanded = expandedId === wo.id;
              const status     = WORK_ORDER_STATUS_LABELS[wo.status as keyof typeof WORK_ORDER_STATUS_LABELS] ?? wo.status;
              const woLabel    = wo.orderNumber ? `WO-${wo.orderNumber}` : `WO-${wo.id.slice(0, 8)}`;

              return (
                <div
                  key={wo.id}
                  className="rounded-[var(--radius-lg)] border bg-[var(--color-panel)] overflow-hidden"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  {/* Row header */}
                  <button
                    className="w-full text-left px-[var(--space-5)] py-[var(--space-4)] flex items-center gap-[var(--space-4)] hover:bg-[var(--color-sunken)] transition-colors"
                    onClick={() => handleExpand(wo.id)}
                  >
                    <div className="flex-1 flex flex-wrap items-center gap-[var(--space-3)]">
                      <span className="font-[var(--weight-medium)] text-[var(--text-sm)]">{woLabel}</span>
                      <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">·</span>
                      <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">{wo.companyName}</span>
                      {wo.isExpedited && (
                        <span
                          className="px-[var(--space-2)] py-[1px] rounded-full text-[var(--text-xs)] font-[var(--weight-medium)]"
                          style={{
                            background: "var(--status-warning-bg)",
                            color:      "var(--status-warning-text)",
                            border:     "1px solid var(--status-warning-border)",
                          }}
                        >
                          Expedited
                        </span>
                      )}
                    </div>

                    <span
                      className="shrink-0 px-[var(--space-2)] py-[1px] rounded-full text-[var(--text-xs)]"
                      style={{
                        background: wo.status === "in_progress"
                          ? "var(--status-info-bg)"
                          : wo.status === "completed"
                          ? "var(--status-success-bg)"
                          : "var(--color-sunken)",
                        color: wo.status === "in_progress"
                          ? "var(--status-info-text)"
                          : wo.status === "completed"
                          ? "var(--status-success-text)"
                          : "var(--color-text-muted)",
                      }}
                    >
                      {status}
                    </span>

                    <span className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-muted)]">
                      {wo.doneCount}/{wo.totalPieces} pieces
                    </span>

                    {wo.claimedByName && (
                      <span className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-muted)]">
                        {wo.claimedByName}
                      </span>
                    )}

                    {wo.dueDate && (
                      <span className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-muted)]">
                        Due {wo.dueDate}
                      </span>
                    )}

                    <span
                      className="shrink-0 text-[var(--text-muted)] text-[var(--text-base)]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div
                      className="border-t px-[var(--space-5)] py-[var(--space-4)]"
                      style={{ borderColor: "var(--color-border-subtle)" }}
                    >
                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-[var(--space-2)] mb-[var(--space-4)]">
                        {canClaim && wo.status === "pending" && (
                          <Button size="sm" onClick={() => handleClaim(wo.id)}>
                            Begin Production
                          </Button>
                        )}
                        {canManage && wo.status === "in_progress" && (
                          <Button size="sm" variant="secondary" onClick={() => {
                            setRecutModalWoId(wo.id);
                            // Ensure full data is loaded
                            if (!fullData.has(wo.id)) handleExpand(wo.id);
                          }}>
                            Record Non-Billable Re-cut
                          </Button>
                        )}
                        {canQC && wo.status === "in_progress" && (
                          <Button size="sm" onClick={() => setQcModalWoId(wo.id)}>
                            Finalize Production
                          </Button>
                        )}
                        {canPrint && (wo.status === "pending" || wo.status === "in_progress" || wo.status === "completed" || wo.status === "awaiting_pickup") && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => window.open(`/api/production/${wo.id}/print?type=work-order`, "_blank")}
                            >
                              Print Work Order
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => window.open(`/api/production/${wo.id}/print?type=labels`, "_blank")}
                            >
                              Print Labels
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Piece detail */}
                      {getFullWo(wo.id) ? (
                        <WorkOrderDetail
                          woId={wo.id}
                          canManage={canManage && wo.status === "in_progress"}
                          canQC={canQC}
                          onNeedData={getFullWo}
                        />
                      ) : (
                        <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">Loading details…</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QC Modal */}
      <QcModal
        open={qcModalWoId !== null}
        workOrderId={qcModalWoId ?? ""}
        orderNumber={qcWo?.orderNumber ?? null}
        onClose={() => setQcModalWoId(null)}
        onSubmit={handleQCSubmit}
      />

      {/* Recut Modal */}
      <RecutModal
        open={recutModalWoId !== null}
        lines={recutFull?.lines ?? []}
        onClose={() => setRecutModalWoId(null)}
        onSubmit={handleRecutSubmit}
      />
    </div>
  );
}
