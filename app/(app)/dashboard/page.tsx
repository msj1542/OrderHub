import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { getDashboardCounts } from "@/lib/orders/service";
import Link from "next/link";

export const metadata = { title: "Dashboard — Ordering Hub" };

function StatCard({ label, value, href, accent }: { label: string; value: number; href?: string; accent?: boolean }) {
  const inner = (
    <div
      className="flex flex-col gap-[var(--space-2)] p-[var(--space-6)] rounded-[var(--radius-lg)] border bg-[var(--color-panel)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
      style={{
        borderColor: accent ? "var(--status-warning-border)" : "var(--color-border-subtle)",
        background: accent ? "var(--status-warning-bg)" : undefined,
      }}
    >
      <span
        className="text-[var(--text-2xl)] font-[var(--weight-bold)]"
        style={{ color: accent ? "var(--status-warning-text)" : "var(--color-text-primary)" }}
      >
        {value}
      </span>
      <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">{label}</span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

export default async function DashboardPage() {
  const user   = await requireUser();
  const counts = await getDashboardCounts(user);

  return (
    <div className="flex flex-col gap-[var(--space-8)] p-[var(--space-6)]">
      <div>
        <h1 className="text-[var(--text-xl)] font-[var(--weight-semibold)]">
          Welcome back, {user.name}
        </h1>
        <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-[var(--space-1)]">
          {user.role.isInternal ? user.role.displayName : (user.company?.name ?? "Your account")}
        </p>
      </div>

      <div
        className="grid gap-[var(--space-4)]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
      >
        {user.role.isInternal ? (
          <>
            <StatCard
              label="Awaiting Acceptance"
              value={counts.submittedCount}
              href="/orders?status=submitted"
              accent={counts.submittedCount > 0}
            />
            <StatCard
              label="Expedited Active"
              value={counts.expeditedCount}
              href="/orders"
              accent={counts.expeditedCount > 0}
            />
            <StatCard
              label="Cancellation Requests"
              value={counts.cancellationCount}
              href="/orders"
              accent={counts.cancellationCount > 0}
            />
          </>
        ) : (
          <>
            <StatCard label="Open Drafts" value={counts.draftCount} href="/orders" />
            <StatCard label="Active Orders" value={counts.submittedCount} href="/orders" />
          </>
        )}
      </div>

      <div className="flex gap-[var(--space-4)] flex-wrap">
        {can(user, "order:create") && (
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-[var(--space-2)] px-[var(--space-5)] py-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[var(--text-base)] font-[var(--weight-medium)] hover:bg-[var(--color-brand-hover)] transition-colors"
          >
            Place New Order
          </Link>
        )}
        {can(user, "catalog:view") && (
          <Link
            href="/catalog"
            className="inline-flex items-center gap-[var(--space-2)] px-[var(--space-5)] py-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-panel)] text-[var(--text-base)] text-[var(--color-text-primary)] hover:bg-[var(--color-sunken)] transition-colors"
          >
            Browse Catalog
          </Link>
        )}
      </div>
    </div>
  );
}
