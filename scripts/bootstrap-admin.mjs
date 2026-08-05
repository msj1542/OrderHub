/**
 * One-time bootstrap: creates the initial internal_admin user row in
 * public.users and sends a Supabase invite email to INITIAL_ADMIN_EMAIL.
 *
 * Safe to re-run — idempotent (skips if the user row already exists).
 *
 * Run: node --env-file=.env.local scripts/bootstrap-admin.mjs
 */

import postgres   from "postgres";
import { createClient } from "@supabase/supabase-js";

const {
  DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  INITIAL_ADMIN_EMAIL,
  NEXT_PUBLIC_APP_URL = "http://localhost:3000",
} = process.env;

if (!INITIAL_ADMIN_EMAIL) {
  console.error("❌  INITIAL_ADMIN_EMAIL is not set in .env.local");
  process.exit(1);
}

const sql   = postgres(DATABASE_URL, { prepare: false, max: 1 });
const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\nBootstrapping initial admin: ${INITIAL_ADMIN_EMAIL}\n`);

// 1. Ensure the users row exists.
const existing = await sql`
  SELECT id FROM public.users WHERE email = ${INITIAL_ADMIN_EMAIL} LIMIT 1
`;

let adminUserId;
if (existing.length) {
  adminUserId = existing[0].id;
  console.log(`  ✅  public.users row already exists (id: ${adminUserId})`);
} else {
  const [row] = await sql`
    INSERT INTO public.users (email, name, role_code)
    VALUES (${INITIAL_ADMIN_EMAIL}, ${"Admin"}, ${"internal_admin"})
    RETURNING id
  `;
  adminUserId = row.id;
  console.log(`  ✅  Created public.users row (id: ${adminUserId})`);
}

// 2. Invite via Supabase Auth (creates auth.users row → triggers link).
const { data: authData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
  INITIAL_ADMIN_EMAIL,
  { redirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?type=invite` }
);

if (inviteErr) {
  if (inviteErr.message.includes("already been registered")) {
    console.log(`  ✅  Auth user already exists — no new invite sent`);
  } else {
    console.error(`  ❌  Invite error: ${inviteErr.message}`);
    await sql.end();
    process.exit(1);
  }
} else {
  console.log(`  ✅  Invite sent to ${INITIAL_ADMIN_EMAIL} (auth id: ${authData.user?.id})`);
}

await sql.end();
console.log("\n✅  Bootstrap complete. Check your email for the invite link.\n");
