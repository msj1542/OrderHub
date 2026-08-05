# Deferred items & known deviations

This file tracks intentional deferrals and architectural deviations from REBUILD_PLAN.md.
It is updated after each phase audit. Items are resolved by striking them out when addressed.

---

## Architectural deviations

### RLS is defense-in-depth, not primary scoping (Phase 1)
**Plan said:** "App requests run as the `authenticated` role with the user's JWT claims" —
Drizzle queries would enforce scoping via Postgres RLS policies automatically.

**Actual:** All Drizzle queries use a **service-role connection** that bypasses RLS. Scoping
is enforced in app code via `can()` and explicit `WHERE` filters per route. RLS policies are
still present and block any direct / PostgREST access.

**Root cause:** Supabase's transaction-mode pooler (port 6543) does not support `SET LOCAL`
for per-request JWT claims injection, which is required for Drizzle + RLS to work together.
Session-mode pooler (port 5432) supports it but doesn't scale the same way.

**Risk:** A query that forgets a `WHERE` clause won't be caught by the database. Mitigated by
the `can()` check before every data access and by code review.

**Resolution path:** Evaluate switching to session-mode pooler or Supabase's built-in
PostgREST (which does enforce RLS) for read queries in a future phase.

---

### `auth/callback` is a client page, not a route handler (Phase 1)
**Plan said:** `app/auth/callback/route.ts` (server-side Route Handler).

**Actual:** `app/auth/callback/page.tsx` (client component).

**Reason:** Supabase email links (invite + password reset) use the **implicit grant flow** —
tokens arrive in the URL hash fragment (`#access_token=...`), which the browser strips before
sending the HTTP request. A server-side handler receives empty params and can't do anything
useful. The client page reads `window.location.hash` on mount and handles all three Supabase
link formats (implicit hash, OTP token_hash, PKCE code).

---

## Deferred features

### Transactional email — Resend (Phase 1 → Phase 6)
**Plan decision #2:** "Transactional email is in phase 1 (Resend behind a notification
service, small add)."

**Deferred because:** No order events exist until Phase 3. The `resend` package is already
installed. Defer the `lib/notifications/` module and actual email sends to Phase 6 when the
full notification service (in-app + email) is built together.

**What to do in Phase 6:** Create `lib/notifications/email.ts` (Resend send helper),
`lib/notifications/service.ts` (in-app notification fan-out), and add `RESEND_API_KEY` /
`RESEND_FROM_EMAIL` to environment variables and the GitHub Actions secrets.

---

### Fulfillment role — Orders nav access (Phase 1)
**Decision:** Fulfillment-only users do **not** see the Orders nav item. They access
order details via Production Queue → work order link.

**Users who need both:** Assign `internal_admin` or `order_coordinator` role (both have
`production:view` + full order access). A multi-role system is not planned.

---

### GitHub Actions deploy step (Phase 0)
**Plan:** `.github/workflows/deploy.yml` deploys to Hostinger on every push to `main`.

**Actual:** The deploy step is a no-op (`echo "TODO: wire up Hostinger deploy step"`).

**To complete:** Configure Hostinger SSH deploy key as a GitHub Actions secret
(`HOSTINGER_SSH_KEY` or similar), add the deploy step (rsync / SSH push / Hostinger's
Git integration), and update `next.config.ts` `serverActions.allowedOrigins` to include
the Hostinger production domain.

---

### `next.config.ts` — serverActions.allowedOrigins (Phase 0)
**Current:** `allowedOrigins: ["localhost:3000"]`

**Before go-live:** Add the Hostinger production domain, e.g.:
```ts
allowedOrigins: ["localhost:3000", "orderhub.yourdomain.com"]
```

---

## Remaining cross-cutting UI components (Phase 2+)
The following components from the plan's component list are not yet built.
Add them as each phase needs them:

- `Toggle` (settings booleans — Phase 6)
- `DataTable + ExpandableRow` (Phase 2 — catalog browse table)
- `ConfirmDialog` (Phase 3 — destructive order actions)
- `Alert` (inline form errors — Phase 2+)
- `Timeline` (audit history — Phase 6)
- `MasterDetail` layout primitive (Phase 3 — order workspace)
- `FieldHint / Tooltip` (form guidance — Phase 2+)
- `FormGrid` (settings forms — Phase 6)
