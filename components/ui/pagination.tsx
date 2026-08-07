"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  /** 1-indexed current page. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Server-side pagination footer. Presentational only — the caller owns
 * where `page` comes from (URL search param, local state, etc.) and
 * re-fetches/re-navigates in onPageChange.
 */
export function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] border-t border-[var(--color-border-subtle)]",
        className
      )}
    >
      <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-[var(--space-1)]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </Button>
        <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] px-[var(--space-2)] tabular-nums">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
