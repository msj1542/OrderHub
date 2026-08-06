Phase 6 — What was built

Schema (lib/db/schema.ts) + migration (supabase/migrations/0006_phase6.sql)

5 new tables: notifications, notification_reads, resource_categories, resources, resource_versions

companies gains 4 profile/billing columns: primary_contact_name, contact_email, contact_phone, billing_notes

New Storage bucket: resources (private, 50MB limit, same document/image mime allowlist as product-files)

authenticated-role SELECT RLS added for Realtime (the actual access boundary for browser subscriptions, distinct from the service-role bypass used by app reads):
  - notifications: own / internal-broadcast / company-broadcast (3 policies, OR'd)
  - production_work_orders, production_line_progress: internal-staff-only (production queue has no external use case)
  - resources, resource_categories, resource_versions: internal-sees-all / external sees active+customer-visible+pricing-gated

REPLICA IDENTITY FULL + added to supabase_realtime publication: production_work_orders, production_line_progress, notifications

Seeded 4 resource categories (Price Lists, Install Instructions, Diagrams, Product Images) matching the reference app's document library

Applied to production Supabase and verified (scripts/verify-phase6.mjs): all 3 realtime tables in the publication, 17 RLS policies present, bucket created private.

Notifications

lib/notifications/service.ts — insertNotification(tx, input) (transactional, called from within the caller's own transaction), listNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, getOrderCreatorEmail. Read state is per-user (notification_reads join table) rather than a boolean column, because a broadcast notification is read independently by every recipient — a shared boolean would falsely mark it read for everyone the instant one person opened it.

lib/notifications/visibility.ts — pure mirror of the visibility rule (targeted / internal-broadcast / company-broadcast), documented as needing to stay in sync with the Drizzle query condition and the RLS policies; unit tested.

Trigger wiring (matches the reference app's 6 notification events, inserted inside the same DB transaction as the state change they announce):
  - order submit → order_submitted_customer (company) + order_submitted_internal (broadcast)
  - accept → order_accepted (company)
  - QC complete → fulfillment_completed (internal broadcast)
  - invoice verify → ready_for_pickup (company)
  - request cancellation → cancellation_requested (internal broadcast)

Email (lib/notifications/email.ts + emailGuard.ts) — Resend wrapper, guarded no-op when RESEND_API_KEY/RESEND_FROM_EMAIL don't look like real values (the shipped .env.local has placeholders: RESEND_API_KEY=re_.., RESEND_FROM_EMAIL=orders@yourdomain.com). Fires best-effort (awaited, errors swallowed) after the triggering transaction commits — a failed or skipped send never fails the order transition. Sends to the order's creator only, for the three customer-facing events (submitted, accepted, ready for pickup); the two internal-broadcast events are in-app only, matching the reference app's behavior.

UI: app/(app)/notifications/ (list + mark read/all), components/notifications/notification-list.tsx. Topbar bell shows the real unread count from the server and increments live via a Realtime subscription (components/layout/topbar.tsx) — RLS on notifications is what actually scopes which INSERTs a given browser session receives.

Resources

lib/resources/service.ts — categories + resources + versioned files. Uploading a new version sets it as the resource's current_version_id; full history is retained. lib/resources/visibility.ts is the pure external-visibility rule (active + customer-visible + pricing-gated), shared by both the service and the download route rather than duplicated.

app/api/resources/[id]/route.ts — signed download (60s TTL), same pattern as the Phase 2 product-files route, authz-checked per request.

app/(app)/resources (browse, grouped by category) and app/(app)/settings/resources (admin manager: category quick-add, resource CRUD, file/version upload via the user's own session + storage RLS — same upload pattern as the Catalog Manager's product-file uploader).

Settings hub

Companies (lib/companies/service.ts, app/(app)/settings/companies) — list + editor with the new profile/billing fields, plus a "Preview as this company" launcher (role picker + button) that calls a new enterPreviewAction. The server-side preview guard (assertNotPreview) already existed from Phase 1; this phase adds the admin entry point.

Internal Users + Team (lib/users/service.ts) — shared UserManager component used by both app/(app)/settings/team (internal_admin manages any internal role) and app/(app)/company-users (external company admin invites ordering/reference-only users for their own company). Creating a user inserts the public.users row, then sends a Supabase Auth invite email (admin.auth.admin.inviteUserByEmail); a failed invite rolls back the row so there's no orphan. The existing on_auth_user_created trigger (Phase 1) links auth_user_id automatically once the invite is accepted.

Operations (lib/settings/service.ts + validate.ts, app/(app)/settings/operations) — edits the same application_settings key/value store computeExpectedCompletion already reads (lib/settings/schedule.ts): business timezone, cutoff/completion weekday+time, rush fee mode/value, duplicate-PO window. Pure validation function, unit tested.

Audit History (lib/audit/service.ts, app/(app)/settings/audit) — read-only timeline over the append-only audit_log table (most recent 200 entries), joined to user and order names for display.

Realtime

Production queue (components/production/production-queue.tsx) subscribes to production_work_orders and production_line_progress changes and debounce-refreshes the route (400ms), replacing pure router.refresh()-on-click polling with actual live updates from other users' actions. Notifications bell subscribes similarly for live unread-count increments.

Both subscriptions rely entirely on the authenticated-role RLS policies added in this migration — that's the real access boundary; the client-side code does no additional filtering.

Build-time fix

app/(app)/settings/[section]/page.tsx (the Phase 0-era placeholder catch-all) is now fully superseded — every section it used to stub (companies, team, resources, operations, audit) has a dedicated page. Deleted it and added app/(app)/settings/page.tsx redirecting to /settings/companies for bare access.

Tests (123/123 passing, was 101; +22)

lib/notifications/emailGuard.test.ts (6), lib/notifications/visibility.test.ts (3), lib/resources/visibility.test.ts (4), lib/settings/validate.test.ts (10, includes edge cases like disabled rush fee mode skipping value validation and a zero-day duplicate window).

Known gaps / deferrals

Reminder/escalation scheduler (pg_cron) and M365/Entra SSO remain post-MVP, unscheduled, per REBUILD_PLAN.md.

REBUILD_PLAN.md's Resources row mentions "can pin a product thumbnail" — product thumbnails are already fully handled by the Phase 2 Catalog Manager (product_files.is_thumbnail); duplicating that inside the Resource Manager would be redundant, so it wasn't built. resources.product_id exists in the schema (optional association, mirroring the reference app's documents.product_id) but isn't yet exposed in the Resource Manager form — present for future use, not exercised today.

Browser E2E of the new flows (notifications, resource upload/download, company/user CRUD, operations settings, portal preview entry, realtime updates) was not performed this session — same constraint as Phase 5: signing in requires entering a password, which is outside what an agent may do. Verified via 123/123 unit tests, a clean production build, a direct Supabase query confirming the migration's RLS/publication/bucket state, and code review against established patterns. Recommend a manual click-through, especially of the Realtime paths (open the production queue in two sessions and confirm live updates) and the invite-email flow (confirm Supabase's own invite email actually arrives — that depends on the Supabase project's email configuration, not Resend, and wasn't verified here).

Email sending is code-complete but inert until real RESEND_API_KEY / RESEND_FROM_EMAIL values replace the placeholders in .env.local — no code change needed to activate it, per your instruction this session.
