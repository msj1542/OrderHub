import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await admin.auth.admin.listUsers();
if (error) { console.error(error); process.exit(1); }

for (const u of data.users) {
  console.log({
    id:                  u.id,
    email:               u.email,
    email_confirmed_at:  u.email_confirmed_at ?? null,
    invited_at:          u.invited_at ?? null,
    last_sign_in_at:     u.last_sign_in_at ?? null,
    created_at:          u.created_at,
  });
}
