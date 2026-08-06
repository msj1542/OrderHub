"use client";

import { History } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge }       from "@/components/ui/badge";
import type { AuditEntryWithNames } from "@/lib/audit/service";

function formatWhen(ts: string | Date) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function AuditTimeline({ entries }: { entries: AuditEntryWithNames[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<History size={32} strokeWidth={1.5} />}
        title="No audit history yet"
        description="Every order transition, settings change, and administrative action will show up here."
      />
    );
  }

  return (
    <div className="flex flex-col max-w-3xl" style={{ borderLeft: "2px solid var(--color-border-subtle)" }}>
      {entries.map((e) => (
        <div key={e.id} style={{ position: "relative", padding: "var(--space-4) 0 var(--space-4) var(--space-6)" }}>
          <span
            aria-hidden
            style={{
              position: "absolute", left: -5, top: "var(--space-5)",
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--color-brand)",
            }}
          />
          <div className="flex items-center gap-[var(--space-2)] flex-wrap">
            <p className="text-[var(--text-sm)] font-[var(--weight-medium)]">{e.action}</p>
            <Badge variant="neutral">{e.entityType}</Badge>
            {e.orderNumber && <Badge variant="info">{e.orderNumber}</Badge>}
          </div>
          <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-[var(--space-1)]">
            {e.userName ?? "System"} · {formatWhen(e.createdAt)}
          </p>
          {(e.previousValue || e.newValue) && (
            <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-[var(--space-1)]">
              {e.previousValue ? `${e.previousValue} → ` : ""}{e.newValue}
            </p>
          )}
          {e.reason && (
            <p className="text-[var(--text-xs)] mt-[var(--space-1)]" style={{ fontStyle: "italic" }}>
              "{e.reason}"
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
