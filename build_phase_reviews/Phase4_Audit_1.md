Phase 4 Audit vs. REBUILD_PLAN.md
✅ Built correctly
Item	Plan says	Status
Production queue — scope tabs	"scope tabs, search, table"	Tabs built (Current / Completed / Archived / All)
Production detail	"material groups, piece tally, re-cut history"	All built; ≤45 individual pieces, >45 batched-5
Re-cut modal	Listed	Built; material usage calc = (patternLengthIn + 1) × qty
Printable work order	Route required	/api/production/[id]/print?type=work-order built
Printable labels + QR	Route required	/api/production/[id]/print?type=labels built with SHA-256 trace codes
QC	"QC, transactional status machine"	QC modal + service built; all 3 items gated + attestation
Work order created on accept	Implicit in transactional SM	acceptOrder() creates pending WO in same tx
Claim wired end-to-end	Phase 4 scope	Both "Begin Production" (queue) and "Claim" (order detail) work
order:claim for coordinator	Reference behavior	Added to policy
Tests	Plan requires test suite	18 new tests, 82/82 passing
Gaps and deviations
1. Production queue search — Minor gap
The plan explicitly says "Production queue (scope tabs, search, table)". No search or text filter is implemented. The reference also lacked robust production queue search, so this is low-risk, but the plan called for it. Should land before Phase 7 hardening.

2. Realtime on the production queue — Deviation from the explicit plan
Decision #7 (locked): "Realtime is in now (Supabase Realtime for the production queue and notifications)" and the plan restates: "Realtime and dark mode are folded into the phases above, not deferred."

The production queue currently uses router.refresh() and full page re-fetches. No Supabase Realtime channel is wired. The plan's fallback language does allow dropping it "if it proves to add undue complexity" — but that decision was never made explicitly. Recommend: either wire Realtime in a Phase 4 follow-up or formally acknowledge the fallback clause.

3. Label reprint available only for pending/in_progress — Minor gap
The production queue's "Print Labels" button condition is:

Once QC passes (status: completed, awaiting_pickup), the button disappears. The plan explicitly says labels should be reprintable on demand for damaged pieces at any stage (audit fix #8). The print route itself accepts any work order status — only the UI gate is wrong.

Navigation path findings
Path 1: Label reprint
Path	Built?	Notes
a) Production queue row	Partial — pending/in_progress only	Button hidden after QC. One-line UI fix needed: extend condition to include completed and awaiting_pickup.
b) Order detail page	No	order-detail.tsx has no print buttons, no work order section, and no link to the production queue for any order status.
c) Both	No	Neither path fully covers it.
The plan's intent (audit fix #8) was: "Labels auto-generate at WO creation and can be reprinted (one or many) from the order if damaged." The "from the order" half is not built.

Path 2: Work order visibility from order detail
Not built. When an internal staff member opens an accepted or in_fulfillment order, the order detail shows: status, expected completion date, lines, comments — but no reference to the associated work order. There is no WO number, no assigned user, no "View in Production Queue" link, and no WO status indicator.

The reference shows a production section on the order detail (work order status, assigned user, piece progress summary) for internal staff once the order is accepted. This is a real gap vs. reference behavior — currently the two views (orders workspace and production queue) are completely siloed.

Summary table
#	Item	Type	Severity
1	Production queue search missing	Gap vs. plan	Low
2	Realtime not wired (decision #7 mandated it)	Deviation from explicit plan decision	Medium — needs formal call
3	Print Labels hidden after QC (UI condition too narrow)	Minor gap	Low — one-line fix
4	No label reprint path from order detail	Gap vs. plan intent (audit fix #8)	Medium
5	No work order section/link on order detail	Gap vs. reference behavior	Medium
Items 3, 4, and 5 are related and could be addressed together: add a "Work Order" section to order-detail.tsx for internal users that shows WO status, assigned user, and Print Work Order / Print Labels buttons (gated on can(user, "order:print_labels") and order status ≥ accepted). Fix 3 falls out naturally when that section appears.

Item 2 (Realtime) needs your call — wire it in Phase 4 polish or formally defer it with a note in the plan.