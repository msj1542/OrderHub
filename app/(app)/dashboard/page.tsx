import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { getDashboardCounts, getDashboardActions, type DashboardAction } from "@/lib/orders/service";
import { getSettings } from "@/lib/settings/schedule";
import { CutoffCountdown } from "@/components/orders/cutoff-countdown";
import { StatusPill } from "@/components/ui/status-pill";
import Link from "next/link";

export const metadata = { title: "Dashboard — Ordering Hub" };

function formatDate(ts: string | Date | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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

function ActionRow({ action }: { action: DashboardAction }) {
  const href = action.target === "orders" ? `/orders?id=${action.orderId}` : "/production";
  return (
    <Link
      href={href}
      className="flex items-center gap-[var(--space-4)] p-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-panel)] hover:shadow-[var(--shadow-sm)] transition-shadow"
      style={{
        borderLeft: action.isExpedited ? "3px solid var(--status-urgent-border)" : undefined,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-text-primary)]">
          {action.label}
        </p>
        <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">{action.detail}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[var(--text-sm)] font-[var(--weight-medium)]">
          {action.orderNumber ?? "Draft"}
        </p>
        <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">{action.companyName}</p>
      </div>
      <div className="text-right shrink-0 min-w-[60px]">
        <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
          {action.isExpedited ? "Requested" : "Due"}
        </p>
        <p className="text-[var(--text-sm)] font-[var(--weight-medium)]">{formatDate(action.dueDate)}</p>
        {action.isExpedited && <StatusPill label="Expedited" family="urgent" />}
      </div>
      <span className="text-[var(--color-text-muted)]" aria-hidden>→</span>
    </Link>
  );
}

export default async function DashboardPage() {
  const user   = await requireUser();
  const [counts, settings, actions] = await Promise.all([
    getDashboardCounts(user),
    getSettings(),
    getDashboardActions(user),
  ]);

  return (
    <div className="flex flex-col gap-[var(--space-8)] p-[var(--space-6)]">
      <div className="flex items-start justify-between gap-[var(--space-4)]">
        <div>
          <h1 className="text-[var(--text-xl)] font-[var(--weight-semibold)]">
            Welcome back, {user.name}
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-[var(--space-1)]">
            {user.role.isInternal ? user.role.displayName : (user.company?.name ?? "Your account")}
          </p>
        </div>
        {can(user, "order:create") && (
          <CutoffCountdown
            cutoffWeekday={settings.cutoffWeekday}
            cutoffTime={settings.cutoffTime}
            businessTimezone={settings.businessTimezone}
          />
        )}
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
              label="Due This Week"
              value={counts.dueThisWeekCount}
              href="/orders"
              accent={counts.dueThisWeekCount > 0}
            />
            <StatCard
              label="Overdue"
              value={counts.overdueCount}
              href="/orders"
              accent={counts.overdueCount > 0}
            />
            <StatCard
              label="Cancellation Requests"
              value={counts.cancellationCount}
              href="/orders"
              accent={counts.cancellationCount > 0}
            />
            {can(user, "production:view") && (
              <StatCard
                label="Work Orders Pending"
                value={counts.pendingWorkOrderCount}
                href="/production"
                accent={counts.pendingWorkOrderCount > 0}
              />
            )}
          </>
        ) : (
          <>
            <StatCard label="Drafts" value={counts.draftCount} href="/orders" />
            <StatCard label="Active Orders" value={counts.submittedCount} href="/orders" />
            <StatCard label="Accepted" value={counts.expeditedCount} href="/orders" />
            <StatCard label="Ready for Pickup" value={counts.cancellationCount} href="/orders" />
          </>
        )}
      </div>

      {/* Actions required (internal) / Recent activity (external) */}
      {user.role.isInternal && actions.length > 0 && (
        <section className="flex flex-col gap-[var(--space-4)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] uppercase tracking-wider font-[var(--weight-medium)]">Priority queue</p>
              <h2 className="text-[var(--text-md)] font-[var(--weight-semibold)]">Actions Required</h2>
            </div>
            <Link href="/orders" className="text-[var(--text-sm)] text-[var(--color-brand)] hover:underline">
              View all orders
            </Link>
          </div>
          <div className="flex flex-col gap-[var(--space-3)]">
            {actions.map((action) => (
              <ActionRow key={action.key} action={action} />
            ))}
          </div>
        </section>
      )}

      {user.role.isInternal && actions.length === 0 && (
        <section className="p-[var(--space-6)] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-panel)] text-center">
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            No immediate actions. New submissions and workflow decisions will appear here.
          </p>
        </section>
      )}

      <div className="flex gap-[var(--space-4)] flex-wrap">
        {can(user, "order:create") && (
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-[var(--space-2)] px-[var(--space-5)] py-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[var(--text-base)] font-[var(--weight-medium)] hover:bg-[var(--color-brand-hover)] transition-colors"
          >
            Place New Order
          </Link>
        )}
      </div>
    </div>
  );
}
