/**
 * Resends auth emails for users who need to set up their account.
 *
 * - msj1542@gmail.com: already a confirmed auth user → sends a recovery
 *   (password-reset) email so they can reach /invite and set their password.
 * - michael@glasstintusa.com: brand-new user → creates public.users row
 *   (internal_admin) then sends a fresh invite.
 *
 * Run: node --env-file=.env.local scripts/resend-invites.mjs
 */

import postgres     from "postgres";
import { createClient } from "@supabase/supabase-js";

const {
  DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL = "http://localhost:3000",
} = process.env;

const CALLBACK = `${NEXT_PUBLIC_APP_URL}/auth/callback`;

const sql   = postgres(DATABASE_URL, { prepare: false, max: 1 });

// Admin client (service role) — used for invite + user inspection.
const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Anon client — used for resetPasswordForEmail (sends via Supabase email service).
const anon = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 1. msj1542@gmail.com — recovery email ───────────────────────────────────
console.log("\n── msj1542@gmail.com ───────────────────────────────────────────");

const { error: recoveryErr } = await anon.auth.resetPasswordForEmail(
  "msj1542@gmail.com",
  { redirectTo: CALLBACK },
);

if (recoveryErr) {
  console.error("  ❌  Recovery email failed:", recoveryErr.message);
} else {
  console.log("  ✅  Recovery email sent → /auth/callback → /invite → set password");
}

// ── 2. michael@glasstintusa.com — create row + invite ───────────────────────
console.log("\n── michael@glasstintusa.com ────────────────────────────────────");

const MICHAEL_EMAIL = "michael@glasstintusa.com";

// Upsert public.users row (idempotent).
const existing = await sql`
  SELECT id FROM public.users WHERE email = ${MICHAEL_EMAIL} LIMIT 1
`;

if (existing.length) {
  console.log(`  ✅  public.users row already exists (id: ${existing[0].id})`);
} else {
  const [row] = await sql`
    INSERT INTO public.users (email, name, role_code)
    VALUES (${MICHAEL_EMAIL}, ${"Michael"}, ${"internal_admin"})
    RETURNING id
  `;
  console.log(`  ✅  Created public.users row (id: ${row.id})`);
}

// Send invite (creates auth.users row → trigger links to public.users by email).
const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
  MICHAEL_EMAIL,
  { redirectTo: `${CALLBACK}?type=invite` },
);

if (inviteErr) {
  console.error("  ❌  Invite error:", inviteErr.message);
} else {
  console.log(`  ✅  Invite sent (auth id: ${inviteData.user?.id})`);
}

await sql.end();
console.log("\n✅  Done. Check both inboxes for the emails.\n");
