import { requireEffectiveUser } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { getDashboardCounts, getDashboardActions, type DashboardAction } from "@/lib/orders/service";
import { getSettings, computeExpectedCompletion } from "@/lib/settings/schedule";
import { CutoffCountdown } from "@/components/orders/cutoff-countdown";
import { StatusPill } from "@/components/ui/status-pill";
import { PackageSearch } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Dashboard — Ordering Hub" };

function formatDate(ts: string | Date | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** "Friday the 13th" — used in the cutoff countdown's "to receive by" copy. */
function formatReceiveBy(dateStr: string): string {
  // Parse as a local calendar date (not UTC midnight) so weekday matches.
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday} the ${ordinal(d)}`;
}

function StatCard({
  label, value, href, accent,
}: { label: string; value: number; href?: string; accent?: boolean }) {
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

/** Ready for Pickup gets its own affirmative-green treatment — it's good
    news for the customer, not a "something needs attention" signal. */
function ReadyForPickupCard({ value }: { value: number }) {
  return (
    <Link href="/orders?status=ready_for_pickup">
      <div
        className="flex flex-col gap-[var(--space-2)] p-[var(--space-6)] rounded-[var(--radius-lg)] border shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
        style={{
          borderColor: value > 0 ? "var(--status-success-border)" : "var(--color-border-subtle)",
          background:  value > 0 ? "var(--status-success-bg)" : undefined,
        }}
      >
        <span
          className="text-[var(--text-2xl)] font-[var(--weight-bold)]"
          style={{ color: value > 0 ? "var(--status-success-text)" : "var(--color-text-primary)" }}
        >
          {value}
        </span>
        <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">Ready for Pickup</span>
      </div>
    </Link>
  );
}

function ActionRow({ action }: { action: DashboardAction }) {
  const href = action.target === "orders" ? `/orders?id=${action.orderId}` : "/production";
  const isInvoiceAction = action.key.startsWith("invoice-");
  return (
    <Link
      href={href}
      className="flex items-center gap-[var(--space-4)] p-[var(--space-4)] rounded-[var(--radius-md)] border transition-shadow hover:shadow-[var(--shadow-sm)]"
      style={{
        borderColor: isInvoiceAction ? "var(--status-warning-border)" : "var(--color-border-subtle)",
        background:  isInvoiceAction ? "var(--status-warning-bg)" : "var(--color-panel)",
        borderLeft: action.isExpedited ? "3px solid var(--status-urgent-border)" : undefined,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-text-primary)]">
          {action.label}
        </p>
        <p
          className="text-[var(--text-xs)]"
          style={{ color: isInvoiceAction ? "var(--status-warning-text)" : "var(--color-text-muted)" }}
        >
          {action.detail}
        </p>
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
  const user   = await requireEffectiveUser();
  const [counts, settings, actions] = await Promise.all([
    getDashboardCounts(user),
    getSettings(),
    getDashboardActions(user),
  ]);

  const canOrder = can(user, "order:create");
  const receiveByLabel = canOrder
    ? formatReceiveBy(computeExpectedCompletion(settings, new Date()))
    : undefined;

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

      {/* Place New Order is the primary action, especially for customers —
          it now leads the page instead of competing with the stat cards
          below it, and the cutoff countdown sits right next to it instead
          of hiding in the corner. */}
      {canOrder && (
        <div className="flex items-center gap-[var(--space-4)] flex-wrap">
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-[var(--space-2)] px-[var(--space-6)] py-[var(--space-4)] rounded-[var(--radius-md)] bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[var(--text-lg)] font-[var(--weight-semibold)] hover:bg-[var(--color-brand-hover)] transition-colors"
          >
            Place New Order
          </Link>
          <CutoffCountdown
            cutoffWeekday={settings.cutoffWeekday}
            cutoffTime={settings.cutoffTime}
            businessTimezone={settings.businessTimezone}
            receiveByLabel={receiveByLabel}
          />
        </div>
      )}

      <div
        className="grid gap-[var(--space-4)]"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
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
            <StatCard label="Drafts" value={counts.draftCount} href="/orders?status=draft" />
            <StatCard label="Submitted" value={counts.externalSubmittedCount} href="/orders?status=submitted" />
            <StatCard label="In Production" value={counts.inProductionCount} href="/orders" />
            <ReadyForPickupCard value={counts.readyForPickupCount} />
          </>
        )}
      </div>

      {/* In-production callout (external) — the gap between "accepted" and
          "ready for pickup" otherwise gives the customer no signal at all
          that anything is actually happening. */}
      {!user.role.isInternal && counts.inProductionCount > 0 && (
        <div
          className="flex items-center gap-[var(--space-3)] p-[var(--space-4)] rounded-[var(--radius-md)] border"
          style={{ borderColor: "var(--color-brand-border)", background: "var(--color-brand-subtle)" }}
        >
          <PackageSearch size={20} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
          <p className="text-[var(--text-sm)] text-[var(--color-brand)]">
            {counts.inProductionCount === 1
              ? "Your kit is being produced."
              : `${counts.inProductionCount} of your kits are being produced.`}
            {" "}We'll notify you when it's ready for pickup.
          </p>
        </div>
      )}

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
    </div>
  );
}
