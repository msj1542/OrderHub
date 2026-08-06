import { requireUser } from "@/lib/auth";
import { can, canAny } from "@/lib/authz/policy";
import { redirect } from "next/navigation";
import { listOrders, getOrder } from "@/lib/orders/service";
import { MasterDetail } from "@/components/ui/master-detail";
import { OrdersWorkspace } from "@/components/orders/orders-workspace";
import { OrderDetail } from "@/components/orders/order-detail";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Orders — Ordering Hub" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requireUser();
  if (
    !canAny(user, [
      "order:create", "order:accept", "order:claim",
      "order:qc", "order:invoice_verify", "order:release", "order:close",
    ])
  ) {
    redirect("/dashboard");
  }

  const params    = await searchParams;
  const selectedId = params.id;

  const [orders, selectedOrder] = await Promise.all([
    listOrders(user),
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
