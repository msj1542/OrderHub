import { requireEffectiveUser } from "@/lib/auth";
import { can, canAny } from "@/lib/authz/policy";
import { redirect } from "next/navigation";
import { listOrders, getOrder } from "@/lib/orders/service";
import type { OrderStatus } from "@/lib/db/schema";
import { MasterDetail } from "@/components/ui/master-detail";
import { OrdersWorkspace } from "@/components/orders/orders-workspace";
import { OrderDetail } from "@/components/orders/order-detail";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Orders — Ordering Hub" };

const PAGE_SIZE = 25;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; q?: string; status?: string; page?: string }>;
}) {
  const user = await requireEffectiveUser();
  if (
    !canAny(user, [
      "order:create", "order:accept", "order:claim",
      "order:qc", "order:invoice_verify", "order:release",
    ])
  ) {
    redirect("/dashboard");
  }

  const params    = await searchParams;
  const selectedId = params.id;
  const search     = params.q ?? "";
  // No status param at all → default to "active" (hides closed/released/
  // invoiced/canceled clutter). An explicit "all" is how the user opts back
  // into seeing everything; a specific status is passed through as-is.
  const status: OrderStatus | "active" | "all" =
    params.status === undefined || params.status === "" ? "active"
    : params.status === "all" ? "all"
    : (params.status as OrderStatus);
  const page       = Math.max(1, Number(params.page) || 1);

  const [{ orders, total }, selectedOrder] = await Promise.all([
    listOrders(user, {
      search: search || undefined,
      status: status === "all" ? undefined : status,
      page,
      pageSize: PAGE_SIZE,
    }),
    selectedId ? getOrder(selectedId, user) : null,
  ]);

  const canSeePrice = can(user, "pricing:view");
  const canCreate   = can(user, "order:create");

  const list = (
    <div className="flex flex-col h-full">
      {canCreate && (
        <div className="px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border-subtle)]">
          <Button asChild size="sm" className="w-full">
            <Link href="/orders/new">+ New Order</Link>
          </Button>
        </div>
      )}
      <OrdersWorkspace
        orders={orders}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        search={search}
        status={status}
        selectedId={selectedId}
        canSeePrice={canSeePrice}
        isInternal={user.role.isInternal}
      />
    </div>
  );

  const detail = selectedOrder ? (
    <OrderDetail order={selectedOrder} user={user} />
  ) : (
    <EmptyState
      icon={<ClipboardList size={32} />}
      title="Select an order"
      description="Choose an order from the list to view its details."
    />
  );

  return (
    <MasterDetail
      list={list}
      detail={detail}
      hasSelection={!!selectedId}
      className="h-full"
    />
  );
}
