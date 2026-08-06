Phase 6 Audit vs. REBUILD_PLAN.md

✅ Built correctly

| Item | Plan says | Status |
|---|---|---|
| Resource library | "categories, download" | Built — `/resources`, grouped by category, download links |
| Resource manager | "upload, versions, pricing-restricted" | Built — categories + resources + versioned uploads, pricing gate |
| Company users portal | "external admin" | Built — `/company-users`, external_admin self-service |
| External user manager | "primary admin + company users" | Built — shared `UserManager`, invite + activate/deactivate |
| Settings hub | "tabbed" | Built — `SettingsNav` tabs, all 7 sections have dedicated pages |
| Customers (company list + editor) | Listed | Built — `/settings/companies` |
| Company editor | "profile + billing" | Built — added `primary_contact_name`, `contact_email`, `contact_phone`, `billing_notes` |
| Internal users manager | Listed | Built — `/settings/team` |
| Operations settings | "rush fee, cutoff group, completion group, duplicate window, timezone" | Built — all 5, pure-validated |
| Audit history | "timeline" | Built — `/settings/audit`, most recent 200 entries |
| Notifications | "current / history, mark read/all" | Built — list + mark one/all read |
| Notification service | "in-app + Resend email" | Built — in-app live; Resend wired, guarded no-op until real credentials |
| Storage buckets + policies + signed-URL downloads | Listed | Built — `resources` bucket, same signed-URL pattern as Phase 2 |
| Realtime channels | "production queue + notifications" | Built — see verification section below |
| Material settings | "list + editor + rolls + cost outputs" | Already built Phase 2 — confirmed still present and untouched |
| Dark mode toggle | Decision #9 | Already shipped Phase 0 — confirmed still present and untouched |

Gaps and deviations

1. Portal preview is a launcher, not a modal — Low severity
REBUILD_PLAN.md's checklist item reads "Portal preview (admin) modal + server-enforced read-only mode." The server-enforced guard (`assertNotPreview`) has existed since Phase 1 and is unaffected. What Phase 6 adds is a role picker + "Preview as this company" button embedded directly in the company editor panel (`components/settings/company-manager.tsx`) — it is not wrapped in a `Dialog`/modal component. Functionally complete (sets the same cookie, same guard applies), but a literal reading of the checklist wanted a modal and got an inline panel section instead. No behavior gap, just a UI-pattern deviation.

2. `resources.product_id` exists but is unused by the UI — Low severity, intentional
The schema/migration include an optional `product_id` FK on `resources` (mirroring the reference app's `documents.product_id`), but neither `createResource()`'s input type nor the Resource Manager form exposes a product selector. Confirmed via grep: the column is defined in `lib/db/schema.ts` and the migration, with zero references in `components/resources/resource-manager.tsx`. This was called out as a known, intentional deferral in `Phase6_Completion.md` — verified accurate, not a surprise finding.

3. Triple implementation of the notification visibility rule — Low severity, by necessity
Unlike resource visibility (which is one function called from all four sites — see verification below), notification visibility exists as three separate implementations: a pure TS function, a Drizzle SQL condition, and RLS policies. This is unavoidable (SQL can't import TS, and RLS can't call app code), but it is a standing maintenance risk — a future change to the rule must be applied in three places by hand, and only one of the three (the pure function) has automated test coverage. Recommend a code comment or lint rule reminder if this rule ever changes; not a defect today (see verification — all three currently match).

No other deviations found. Everything else in the Phase 6 checklist — including cross-cutting items (RLS, Realtime, storage) and the Users & Settings / Notifications & admin tools sections — matches what REBUILD_PLAN.md specifies.

Verification: requested items

1. Notification visibility rule — synced across all three implementations ✓
   - `lib/notifications/visibility.ts` (`canSeeNotification`): targeted-to-me → true; targeted at someone else → false; broadcast (`userId` null) → internal always true, external only if `companyId` matches.
   - `lib/notifications/service.ts` (`visibilityCondition`, Drizzle): internal — `userId = me OR userId IS NULL`; external — `userId = me OR (userId IS NULL AND companyId = myCompanyId)`. Walked every branch (targeted/internal-broadcast/company-broadcast/internal-only-broadcast-viewed-by-external) by hand — all match the pure function, including the NULL-vs-NULL SQL edge case (an internal-only broadcast, `company_id IS NULL`, correctly never matches an external viewer's real company UUID).
   - Migration `0006_phase6.sql` RLS: 3 policies (`notifications_select_own`, `_broadcast_internal`, `_broadcast_company`), OR'd as Postgres permissive policies. Same three branches, same result in every case checked.
   - Conclusion: all three match. `lib/notifications/visibility.test.ts` (3 tests) covers the pure function; the SQL/RLS copies were cross-checked by hand this audit (no integration-test infrastructure exists to automate that comparison — consistent with the project's established pure-unit-test-only pattern).

2. Resource visibility rule — synced across all four sites ✓ (stronger than "synced": three of the four literally call the same function)
   - `lib/resources/visibility.ts` (`canExternalUserSeeResource`): the single source of truth — `!isActive || !customerVisible` → false; `pricingRestricted && !viewer.pricingVisible` → false; else true.
   - `lib/resources/service.ts`'s `listResources()` and `getResource()` both import and call `canExternalUserSeeResource` directly — not a re-implementation, the same function.
   - `app/api/resources/[id]/route.ts` also imports and calls the same function directly.
   - Migration `0006_phase6.sql`'s `resources_select_external` RLS policy: `NOT internal AND is_active AND customer_visible AND (pricing_restricted = false OR company.pricing_visible = true)` — the one implementation that must be independent SQL, and it matches the shared TS function's logic exactly.
   - Conclusion: consistent. This is a better-than-notifications design specifically because three of the four call sites share one function instead of re-implementing the rule.

3. Realtime prerequisites — all three confirmed against production Supabase ✓
   - Publication membership: `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'` returns all 3 tables (`notifications`, `production_line_progress`, `production_work_orders`).
   - `REPLICA IDENTITY FULL`: queried `pg_class.relreplident` for all 3 tables this audit — all report `'f'` (full). Confirmed via a one-off verification query.
   - Authenticated-role RLS: 17 policies present across the 7 Phase 6/4-touched tables, including the Realtime-relevant `authenticated`-role SELECT policies on all 3 tables (verified via `pg_policies` — same result as at Phase 6 completion, re-confirmed this audit).
   - Conclusion: all three Realtime prerequisites are met and independently re-verified against the live database, not just re-read from the migration file.

4. Material settings — built, Phase 2, unaffected by Phase 6
   `app/(app)/settings/materials/page.tsx` + `components/catalog/material-settings.tsx` confirmed present and untouched by any Phase 6 commit. REBUILD_PLAN.md's checklist lists it once under Settings hub; it was already satisfied before Phase 6 began.

5. Dark mode toggle — built, Phase 0, unaffected by Phase 6
   `components/ui/theme-toggle.tsx` confirmed present. Shipped in Phase 0 per decision #9 (tokens authored light+dark from the start, toggle shipped immediately since it "landed cheaply"). No Phase 6 change touched it.

6. Product-thumbnail pinning in Resource Manager — confirmed acceptable deferral
   `resources.product_id` is defined in both the migration and `lib/db/schema.ts` (nullable FK to `products`), and is not referenced anywhere in `components/resources/resource-manager.tsx` (confirmed via grep — zero matches). Matches what `Phase6_Completion.md` already documented as a known, intentional gap: product thumbnails are fully handled by the Phase 2 Catalog Manager (`product_files.is_thumbnail`), so duplicating that inside the Resource Manager would be redundant. No action needed.

Summary table

| # | Item | Type | Severity |
|---|---|---|---|
| 1 | Portal preview built as an inline launcher, not a modal | Deviation from literal checklist wording | Low |
| 2 | `resources.product_id` unused by UI | Intentional, documented deferral | Low |
| 3 | Notification visibility rule implemented 3x (pure fn / SQL / RLS) | Structural risk, not a defect today | Low |
| — | Notification visibility sync | Verified consistent | N/A |
| — | Resource visibility sync | Verified consistent (shared function) | N/A |
| — | Realtime prerequisites (publication / replica identity / RLS) | Verified against live DB | N/A |
| — | Material settings, dark mode | Confirmed still built (Phase 0/2), unaffected | N/A |

No blocking gaps found. Phase 6 matches REBUILD_PLAN.md's checklist with three low-severity, non-blocking notes above.
