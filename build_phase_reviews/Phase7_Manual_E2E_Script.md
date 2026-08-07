# Phase 7 — Manual Browser E2E Script

This covers everything that couldn't be verified by an agent: every page requires a
Supabase Auth login (email + password), and entering credentials/passwords into a form is
outside what an agent may do. This has been true since Phase 4 (see prior handoff docs) —
Phases 4–6 were verified via unit tests, clean builds, and direct Supabase state checks
instead. This script closes that gap for the full order lifecycle, Realtime, invites, and
portal preview, and adds checks for everything new in Phase 7 (pagination, empty states,
a11y, the RLS fix).

Run against the local dev server (`npm run dev`) or a deployed environment. Where a step
needs two simultaneous sessions, use two browser windows/profiles (or one normal + one
incognito) signed in as different users.

---

## 1. Full order lifecycle

Use one `external_ordering` (or `external_admin`) account and enough internal accounts to
cover each role, or `internal_admin` throughout if that's simpler.

1. **New order** (external user or internal on their behalf): `/orders/new` → search the
   catalog, add 2–3 line items, optionally a custom item, save as **draft**, confirm it
   appears in Orders with status "Draft".
2. **Submit**: open the draft, submit it. Confirm status → "Submitted", an order number is
   assigned (`OH-2026-#####`), and (if internal) a notification appears for coordinators.
3. **Duplicate PO check**: submit a second order with the same PO number for the same
   company within the configured duplicate window (Settings → Operations) — confirm it's
   blocked or flagged.
4. **Accept** (order_coordinator/internal_admin): open the submitted order, Accept it.
   Confirm status → "Accepted", a work order appears in Production Queue ("Current Work"
   tab), and the customer gets an `order_accepted` notification (+ email if Resend is
   configured).
5. **Claim / Begin Production** (fulfillment/internal_admin): in Production Queue, expand
   the work order, click "Begin Production". Confirm status → "In Fulfillment" /
   `in_progress`.
6. **Piece tally**: tick off pieces (or batches, if >45 pieces) in the expanded work order.
   Confirm the done/total count updates live without a full page reload.
7. **Re-cut** (optional): "Record Non-Billable Re-cut" on an in-progress work order, submit
   a reason + quantity, confirm it shows in the expanded detail with the computed material
   usage.
8. **QC / Finalize Production**: click "Finalize Production", check all 3 QC items (confirm
   the attestation checkbox stays disabled until all 3 are checked), submit. Confirm order
   status → "Fulfillment Completed", work order → `completed`, and an internal broadcast
   notification fires.
9. **Invoice verify** (accounting/internal_admin): open the order, run invoice
   verification. Confirm it shows the **real** line items/SKUs/quantities/totals (not
   placeholder text), and that a discrepancy reason is required if you intentionally
   mismatch a total. On match, confirm status → "Ready for Pickup", work order →
   `awaiting_pickup`, and a customer notification/email fires.
10. **Release**: release the order. Confirm status → "Released", work order → `released`.
11. **Print Labels on a released work order**: confirm the "Print Labels" button is still
    present and works post-release (this was a Phase 6 audit fix — regression-check it).
12. **Close**: close the order. Confirm status → "Closed".
13. **Cancellation branch**: on a different order (Submitted or Accepted), request
    cancellation as the external user, confirm the coordinator sees a
    `cancellation_requested` notification, then test both **decline** (order returns to its
    prior status, request marked resolved) and **cancel** (order → "Canceled") paths on two
    separate test orders.
14. **Reorder**: from a closed/released order, use "Reorder" — confirm it prefills company +
    re-resolves line items against the current catalog (a line whose product was
    deactivated since should be dropped, not crash).
15. **Supplemental order**: from a submitted/accepted order, use "Supplemental Order" —
    confirm it prefills company only (not lines) and links back to the parent order.

## 2. Realtime (two sessions)

1. Open Production Queue in two browser sessions as two different internal users.
2. In session A, claim a work order or tick a piece off. Confirm session B's view updates
   within ~1 second **without a manual refresh** (the debounced Realtime subscription).
3. Open Notifications (or just the topbar bell) in both sessions. Trigger a notification
   event (e.g. submit an order) from a third session/account. Confirm the unread badge
   increments live in both open sessions.

## 3. Invite email

1. As an internal admin, go to Settings → Team, invite a new internal user with a real,
   reachable email address.
2. Confirm the invite email actually arrives (this depends on the Supabase project's own
   email configuration, not Resend — this has never been directly confirmed in any prior
   phase).
3. Click the invite link, confirm it lands on `/invite`, set a password, confirm it signs
   you in and the `on_auth_user_created` trigger linked the row (no duplicate/orphan user).
4. Repeat once via Company Users (external self-service invite) as an `external_admin`.

## 4. Portal preview

1. As `internal_admin`, go to Settings → Companies, select a company, use the "Preview as
   this company" launcher (role picker + button, an inline panel not a modal — that's
   intentional, see HANDOFF).
2. Confirm the sidebar/nav now reflects the previewed role, a preview banner is visible,
   and every write action is blocked (try submitting a comment or an order — should be
   rejected server-side, not just hidden in the UI).
3. Exit preview via the banner, confirm you're back to your real internal_admin session.

## 5. Phase 7 additions — spot-check

**Pagination** (new this phase — orders, production, catalog, audit, notifications):
1. On each of those 5 list views, confirm a "Page X of Y" footer with Prev/Next appears
   once there are more than 25 rows (catalog already has 38 products in production seed
   data — Prev/Next should be visible there without needing to seed more).
2. Click Next/Prev, confirm the URL gets a `?page=` param and the list updates.
3. On Orders and Catalog, type into the search box, confirm the URL gets a `?q=` param
   after a brief debounce and the page resets to 1.
4. On Orders, click a status filter chip, confirm it narrows results and resets to page 1.

**Empty states:**
1. If you have (or can make) a company/user with zero orders, zero materials, zero
   companies, etc., confirm each shows a clear message instead of a blank panel.

**Accessibility:**
1. Tab through a page with a sortable table (Catalog browse) using only the keyboard —
   confirm you can reach a column header and press Enter/Space to sort it.
2. Visually confirm muted/secondary text (timestamps, hints) is legibly readable, not
   washed out — this was measurably adjusted this phase (contrast fix in `tokens.css`).

**RLS own-scope fix:**
1. This is best checked at the database level, not the UI (the app layer already enforced
   this correctly before the fix — the fix targets `authenticated`-role RLS, which app
   reads don't go through). If you want to verify directly: set a test company's
   `order_scope` to `'own'`, create two users in it, have each submit an order, then query
   `orders` as one user's JWT via the Supabase SQL editor's "run as user" feature (or the
   `anon`/`authenticated` client) and confirm the other user's order isn't visible.

## 6. Deploy pipeline (once Vercel is wired — see HANDOFF_Phase6-7.md)

1. Push a commit to `main`. Watch the GitHub Action run (migrations + build validation) and
   the Vercel dashboard (actual deploy — auto-triggered separately by Vercel's GitHub
   integration, not by the Action).
2. Load the Vercel-assigned domain (or the custom domain, once configured), confirm the app
   is live and a login works.

---

Report back anything that fails, looks wrong, or is missing — this script is meant to close
the "never actually clicked through it" gap flagged in every phase since 4, not to be
rubber-stamped.
