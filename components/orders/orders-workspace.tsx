"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/pricing/money";
import { ORDER_STATUS_LABELS, type OrderSummary, type OrderStatus } from "@/lib/db/schema";
import { ORDER_STATUS_FAMILY, StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";

type Props = {
  orders:        OrderSummary[];
  selectedId?:   string;
  canSeePrice:   boolean;
  isInternal:    boolean;
};

const ALL_STATUSES: OrderStatus[] = [
  "draft", "submitted", "accepted", "in_fulfillment",
  "fulfillment_completed", "ready_for_pickup", "released", "invoiced", "closed", "canceled",
];

export function OrdersWorkspace({ orders, selectedId, canSeePrice, isInternal }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [search, setSearch]   = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<OrderStatus | "">("");

  const filtered = orders.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (o.orderNumber ?? "").toLowerCase().includes(q) ||
        (o.poNumber   ?? "").toLowerCase().includes(q) ||
        o.companyName.toLowerCase().includes(q)        ||
        o.createdByName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function selectOrder(id: string) {
    const params = new URLSearchParams({ id });
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)] border-b border-[var(--color-border-subtle)]">
        <Input
          placeholder="Search orders, PO, company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-[var(--space-2)]">
          <button
            onClick={() => setStatusFilter("")}
            className={cn(
              "px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-pill)] text-[var(--text-xs)] border transition-colors",
              statusFilter === ""
                ? "bg-[var(--color-brand)] text-[var(--color-brand-fg)] border-[var(--color-brand)]"
                : "bg-[var(--color-panel)] text-[var(--color-text-muted)] border-[var(--color-border-default)] hover:bg-[var(--color-sunken)]"
            )}
          >
            All
          </button>
          {ALL_STATUSES.filter((s) => orders.some((o) => o.status === s)).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
              className={cn(
                "px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-pill)] text-[var(--text-xs)] border transition-colors",
                statusFilter === s
                  ? "bg-[var(--color-brand)] text-[var(--color-brand-fg)] border-[var(--color-brand)]"
                  : "bg-[var(--color-panel)] text-[var(--color-text-muted)] border-[var(--color-border-default)] hover:bg-[var(--color-sunken)]"
              )}
            >
              {ORDER_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={32} />}
            title="No orders"
            description={search || statusFilter ? "No orders match your filters." : "No orders yet."}
          />
        ) : (
          <ul>
            {filtered.map((order) => {
              const family = ORDER_STATUS_FAMILY[order.status] ?? "neutral";
              const isSelected = order.id === selectedId;
              return (
                <li
                  key={order.id}
                  onClick={() => selectOrder(order.id)}
                  className={cn(
                    "flex flex-col gap-[var(--space-1)] px-[var(--space-4)] py-[var(--space-3)] cursor-pointer border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-sunken)] transition-colors",
                    isSelected && "bg-[var(--color-sunken)] border-l-2 border-l-[var(--color-brand)]"
                  )}
                >
                  <div className="flex items-center justify-between gap-[var(--space-3)]">
                    <span className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                      {order.orderNumber ?? "Draft"}
                    </span>
                    <div className="flex items-center gap-[var(--space-2)]">
                      {order.isExpedited && <StatusPill label="Exp" family="urgent" />}
                      {order.cancellationRequested && <Badge variant="warning">Cancel Req.</Badge>}
                      <StatusPill
                        label={ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                        family={family}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-[var(--space-2)] text-[var(--text-xs)] text-[var(--color-text-muted)]">
                    <span>
                      {isInternal ? order.companyName : order.createdByName}
                      {order.poNumber && <> · PO {order.poNumber}</>}
                    </span>
                    <span className="flex items-center gap-[var(--space-2)]">
                      {order.lineCount} {order.lineCount === 1 ? "item" : "items"}
                      {canSeePrice && parseFloat(order.grandTotal) > 0 && (
                        <> · {formatMoney(parseFloat(order.grandTotal))}</>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
