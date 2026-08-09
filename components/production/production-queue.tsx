"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ClipboardCheck } from "lucide-react";
import { QcModal }     from "@/components/production/qc-modal";
import { RecutModal }  from "@/components/production/recut-modal";
import { LabelPrintDialog } from "@/components/production/label-print-dialog";
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
  const pendingRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef  = React.useRef<number[]>([...initialDone]);

  function toggle(piece: number) {
    if (!canManage) return;
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(piece)) next.delete(piece);
      else next.add(piece);
      const arr = [...next].sort((a, b) => a - b);
      latestRef.current = arr;
      if (pendingRef.current) clearTimeout(pendingRef.current);
      pendingRef.current = setTimeout(() => {
        updatePieceProgressAction(workOrderId, lineId, latestRef.current);
        onUpdate(lineId, latestRef.current);
      }, 300);
      return next;
    });
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
            disabled={!canManage}
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

  function toggleBatch(start: number, end: number) {
    if (!canManage) return;
    const batch = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    setDone((prev) => {
      const allDone = batch.every((p) => prev.has(p));
      const next = new Set(prev);
      if (allDone) batch.forEach((p) => next.delete(p));
      else batch.forEach((p) => next.add(p));
      const arr = [...next].sort((a, b) => a - b);
      latestRef.current = arr;
      if (pendingRef.current) clearTimeout(pendingRef.current);
      pendingRef.current = setTimeout(() => {
        updatePieceProgressAction(workOrderId, lineId, latestRef.current);
        onUpdate(lineId, latestRef.current);
      }, 300);
      return next;
    });
  }

  return (
    <div className="flex flex-wrap gap-[var(--space-1)]">
      {batches.map(([start, end]) => {
        const isDone = isBatchDone(start, end);
        return (
          <button
            key={start}
            onClick={() => toggleBatch(start, end)}
            disabled={!canManage}
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
  onPieceUpdate,
}: {
  woId:      string;
  canManage: boolean;
  canQC:     boolean;
  onNeedData: (woId: string) => WorkOrderFull | null;
  onPieceUpdate: (woId: string, lineId: string, pieces: number[]) => void;
}) {
  const wo = onNeedData(woId);
  if (!wo) return <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] p-[var(--space-4)]">Loading…</p>;

  // Interactive tally boxes only make sense while a work order is actively
  // being cut — once it's past that stage the boxes stop rendering (some
  // lines finalized incomplete) and only the settled count is meaningful.
  const showInteractiveTally = wo.status === "in_progress";

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
          {showInteractiveTally ? (
            <PieceTally
              lineId={line.id}
              workOrderId={wo.id}
              quantity={line.quantity}
              initialDone={line.progress?.completedPieces ?? []}
              canManage={canManage}
              onUpdate={(lineId, pieces) => onPieceUpdate(wo.id, lineId, pieces)}
            />
          ) : null}
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
  total:      number;
  page:       number;
  pageSize:   number;
  activeTab:  Tab;
  canManage:  boolean;
  canQC:      boolean;
  canClaim:   boolean;
  canPrint:   boolean;
};

export function ProductionQueue({
  workOrders,
  total,
  page,
  pageSize,
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
  const [labelPrintWoId, setLabelPrintWoId] = React.useState<string | null>(null);
  const [finalizeConfirmWoId, setFinalizeConfirmWoId] = React.useState<string | null>(null);
  const [actionError, setActionError]       = React.useState<string | null>(null);

  function switchTab(tab: Tab) {
    const params = new URLSearchParams({ tab });
    router.push(`${pathname}?${params.toString()}`);
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams({ tab: activeTab, page: String(nextPage) });
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
      debounce = setTimeout(() => {
        router.refresh();
        // The server-rendered summary (wo.doneCount, wo.totalPieces) refreshes
        // via router.refresh(), but the client-cached per-line detail in
        // fullData does not — drop it so any expanded panel re-fetches
        // current data instead of showing what was true before this event.
        setFullData(new Map());
      }, 400);
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

  // Fetches (and caches) full work-order detail, without the expand/collapse
  // side effect handleExpand carries — used by callers (Print Labels, Record
  // Re-cut) that need the data loaded but must never toggle the panel shut.
  const ensureFullData = React.useCallback(async (woId: string) => {
    if (fullData.has(woId)) return;
    const res = await fetch(`/api/production/${woId}/detail`);
    if (res.ok) {
      const data: WorkOrderFull = await res.json();
      setFullData((m) => new Map(m).set(woId, data));
    }
  }, [fullData]);

  function handleExpand(woId: string) {
    if (expandedId === woId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(woId);
    ensureFullData(woId);
  }

  // Whenever the expanded panel's cached detail is missing (first expand, or
  // dropped by a realtime refresh/action invalidation above), re-fetch it.
  React.useEffect(() => {
    if (expandedId) ensureFullData(expandedId);
  }, [expandedId, ensureFullData]);

  function getFullWo(woId: string): WorkOrderFull | null {
    return fullData.get(woId) ?? null;
  }

  function invalidateFullData(woId: string) {
    setFullData((m) => {
      if (!m.has(woId)) return m;
      const next = new Map(m);
      next.delete(woId);
      return next;
    });
  }

  function handlePieceUpdate(woId: string, lineId: string, pieces: number[]) {
    setFullData((m) => {
      const wo = m.get(woId);
      if (!wo) return m;
      const next = new Map(m);
      next.set(woId, {
        ...wo,
        lines: wo.lines.map((l) =>
          l.id === lineId ? { ...l, progress: { id: l.progress?.id ?? "", completedPieces: pieces } } : l,
        ),
      });
      return next;
    });
  }

  async function handleClaim(woId: string) {
    setActionError(null);
    const res = await claimWorkOrderAction(woId);
    if (res.error) setActionError(res.error);
    else {
      invalidateFullData(woId);
      router.refresh();
    }
  }

  async function handleQCSubmit(answers: Record<string, boolean>, notes: string | null) {
    if (!qcModalWoId) return;
    const res = await submitQCAction(qcModalWoId, answers, notes);
    if (res.error) throw new Error(res.error);
    invalidateFullData(qcModalWoId);
    setQcModalWoId(null);
    router.refresh();
  }

  async function handleRecutSubmit(orderLineId: string, quantity: number, reason: string) {
    if (!recutModalWoId) return;
    const res = await recordRecutAction(recutModalWoId, orderLineId, quantity, reason);
    if (res.error) throw new Error(res.error);
    invalidateFullData(recutModalWoId);
    setRecutModalWoId(null);
    router.refresh();
  }

  const qcWo     = qcModalWoId    ? workOrders.find((w) => w.id === qcModalWoId)    : null;
  const recutWo  = recutModalWoId ? workOrders.find((w) => w.id === recutModalWoId) : null;
  const recutFull = recutModalWoId ? getFullWo(recutModalWoId) : null;
  const labelPrintFull = labelPrintWoId ? getFullWo(labelPrintWoId) : null;
  const finalizeConfirmWo = finalizeConfirmWoId ? workOrders.find((w) => w.id === finalizeConfirmWoId) : null;

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
            className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] border-b-2 transition-colors cursor-pointer"
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
          <EmptyState
            icon={<ClipboardCheck size={32} />}
            title="No work orders"
            description="No work orders in this view."
          />
        ) : (
          <div className="flex flex-col gap-[var(--space-3)]">
            {workOrders.map((wo) => {
              const isExpanded = expandedId === wo.id;
              const status     = WORK_ORDER_STATUS_LABELS[wo.status as keyof typeof WORK_ORDER_STATUS_LABELS] ?? wo.status;
              const woLabel    = wo.orderNumber ? `WO-${wo.orderNumber}` : `WO-${wo.id.slice(0, 8)}`;

              return (
                <div
                  key={wo.id}
                  className="rounded-[var(--radius-lg)] border overflow-hidden"
                  style={{
                    borderColor: wo.isExpedited ? "var(--status-urgent-border)" : "var(--color-border-subtle)",
                    background:  wo.isExpedited ? "var(--status-urgent-bg)" : "var(--color-panel)",
                  }}
                >
                  {/* Row header */}
                  <button
                    className="w-full text-left px-[var(--space-5)] py-[var(--space-4)] flex flex-wrap items-center gap-[var(--space-4)] hover:bg-[var(--color-sunken)] transition-colors"
                    onClick={() => handleExpand(wo.id)}
                  >
                    <div className="flex-1 flex flex-wrap items-center gap-[var(--space-3)]">
                      <span className="font-[var(--weight-medium)] text-[var(--text-sm)]">{woLabel}</span>
                      <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">·</span>
                      <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">{wo.companyName}</span>
                      {wo.isExpedited && (
                        <span
                          className="text-[var(--text-xs)] font-[var(--weight-bold)] uppercase tracking-wide"
                          style={{ color: "var(--status-urgent-text)" }}
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

                    <span className="shrink-0 text-[var(--text-sm)] font-[var(--weight-medium)]" style={{ color: "var(--color-text-primary)" }}>
                      {wo.doneCount}/{wo.totalPieces} pieces
                    </span>

                    {wo.dueDate && (
                      <span className="shrink-0 text-[var(--text-sm)] font-[var(--weight-medium)]" style={{ color: "var(--color-text-primary)" }}>
                        Due {wo.dueDate}
                      </span>
                    )}

                    {wo.claimedByName && (
                      <span className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-muted)]">
                        {wo.claimedByName}
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
                            ensureFullData(wo.id);
                          }}>
                            Record re-cut
                          </Button>
                        )}
                        {canQC && wo.status === "in_progress" && wo.doneCount > 0 && (
                          <Button
                            size="sm"
                            variant={wo.doneCount < wo.totalPieces ? "secondary" : undefined}
                            onClick={() => {
                              if (wo.doneCount < wo.totalPieces) {
                                setFinalizeConfirmWoId(wo.id);
                                return;
                              }
                              setQcModalWoId(wo.id);
                            }}
                          >
                            {wo.doneCount < wo.totalPieces ? "Finalize Incomplete Order" : "Mark Completed"}
                          </Button>
                        )}
                        {canPrint && (wo.status === "pending" || wo.status === "in_progress" || wo.status === "completed" || wo.status === "awaiting_pickup" || wo.status === "released") && (
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
                              onClick={() => {
                                ensureFullData(wo.id);
                                setLabelPrintWoId(wo.id);
                              }}
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
                          onPieceUpdate={handlePieceUpdate}
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

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={goToPage} />

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

      {/* Label Print Dialog */}
      <LabelPrintDialog
        open={labelPrintWoId !== null}
        onClose={() => setLabelPrintWoId(null)}
        workOrderId={labelPrintWoId ?? ""}
        lines={labelPrintFull?.lines ?? []}
      />

      {/* Finalize Incomplete Order confirmation */}
      <ConfirmDialog
        open={finalizeConfirmWoId !== null}
        onOpenChange={(open) => { if (!open) setFinalizeConfirmWoId(null); }}
        title="Finalize Incomplete Order"
        description={
          finalizeConfirmWo
            ? `${finalizeConfirmWo.totalPieces - finalizeConfirmWo.doneCount} of ${finalizeConfirmWo.totalPieces} pieces are incomplete. Finalizing now will recalculate the final price based on completed items only.`
            : undefined
        }
        confirmLabel="Finalize Anyway"
        variant="danger"
        onConfirm={() => {
          const id = finalizeConfirmWoId;
          setFinalizeConfirmWoId(null);
          if (id) setQcModalWoId(id);
        }}
      />
    </div>
  );
}
