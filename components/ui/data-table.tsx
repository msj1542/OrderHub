"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────

export type Column<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render: (row: T) => React.ReactNode;
};

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  expandedContent?: (row: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
}

type SortDir = "asc" | "desc" | null;

// ── DataTable ─────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  rows,
  getKey,
  expandedContent,
  emptyState,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
      if (sortDir === "desc") setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return 0;
    const av = String(col.render(a) ?? "");
    const bv = String(col.render(b) ?? "");
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  return (
    <div
      className={cn("table-wrap", className)}
      style={{ overflowX: "auto" }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "var(--text-sm)",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "2px solid var(--color-border-default)",
              background: "var(--color-sunken)",
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  textAlign: "left",
                  fontWeight: "var(--weight-semibold)",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  width: col.width,
                  userSelect: col.sortable ? "none" : undefined,
                  cursor: col.sortable ? "pointer" : undefined,
                }}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                  {col.header}
                  {col.sortable && (
                    <SortIcon
                      dir={sortKey === col.key ? sortDir : null}
                    />
                  )}
                </span>
              </th>
            ))}
            {expandedContent && <th style={{ width: 80 }} />}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (expandedContent ? 1 : 0)}
                style={{ padding: "var(--space-10)", textAlign: "center" }}
              >
                {emptyState ?? (
                  <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
                    No results
                  </span>
                )}
              </td>
            </tr>
          )}
          {sorted.map((row) => {
            const key = getKey(row);
            const isExpanded = expandedKey === key;
            return (
              <ExpandableRow
                key={key}
                row={row}
                columns={columns}
                isExpanded={isExpanded}
                hasExpand={!!expandedContent}
                onToggle={() => setExpandedKey(isExpanded ? null : key)}
                expandedContent={expandedContent}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── ExpandableRow ─────────────────────────────────────────────

interface ExpandableRowProps<T> {
  row: T;
  columns: Column<T>[];
  isExpanded: boolean;
  hasExpand: boolean;
  onToggle: () => void;
  expandedContent?: (row: T) => React.ReactNode;
}

function ExpandableRow<T>({
  row,
  columns,
  isExpanded,
  hasExpand,
  onToggle,
  expandedContent,
}: ExpandableRowProps<T>) {
  const rowStyle: React.CSSProperties = {
    borderBottom: "1px solid var(--color-border-subtle)",
    background: isExpanded ? "var(--color-brand-subtle)" : undefined,
    cursor: hasExpand ? "pointer" : undefined,
    transition: "background 0.1s",
  };

  return (
    <>
      <tr
        style={rowStyle}
        onClick={hasExpand ? onToggle : undefined}
        onKeyDown={
          hasExpand
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle();
                }
              }
            : undefined
        }
        tabIndex={hasExpand ? 0 : undefined}
        aria-expanded={hasExpand ? isExpanded : undefined}
        className={hasExpand ? "hover:bg-[var(--color-sunken)]" : undefined}
      >
        {columns.map((col) => (
          <td
            key={col.key}
            style={{
              padding: "var(--space-3) var(--space-4)",
              verticalAlign: "middle",
            }}
          >
            {col.render(row)}
          </td>
        ))}
        {hasExpand && (
          <td
            style={{
              padding: "var(--space-3) var(--space-4)",
              textAlign: "right",
              color: "var(--color-text-muted)",
            }}
          >
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "inherit",
                padding: "var(--space-1)",
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                fontSize: "var(--text-xs)",
                fontWeight: "var(--weight-medium)",
                borderRadius: "var(--radius-sm)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="hover:bg-[var(--color-sunken)]"
            >
              {isExpanded ? "Close" : "Details"}
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </td>
        )}
      </tr>
      {isExpanded && expandedContent && (
        <tr style={{ borderBottom: "1px solid var(--color-border-default)" }}>
          <td
            colSpan={columns.length + 1}
            style={{
              padding: 0,
              background: "var(--color-canvas)",
            }}
          >
            {expandedContent(row)}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Sort icon ─────────────────────────────────────────────────

function SortIcon({ dir }: { dir: SortDir }) {
  if (!dir) return <ChevronsUpDown size={11} style={{ opacity: 0.4 }} />;
  if (dir === "asc") return <ChevronUp size={11} />;
  return <ChevronDown size={11} />;
}
