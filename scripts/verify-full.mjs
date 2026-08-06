import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

try {
  const tables = await sql`
    SELECT c.relname AS table, c.relrowsecurity AS rls_enabled,
      (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname='public') AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `;
  console.log("=== Tables: RLS enabled / policy count ===");
  for (const t of tables) console.log(`  ${t.table}: rls=${t.rls_enabled} policies=${t.policy_count}`);

  console.log("\n=== authenticated-role SELECT policies (Realtime-relevant) ===");
  const authPolicies = await sql`
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND 'authenticated' = ANY(roles)
    ORDER BY tablename, policyname;
  `;
  for (const p of authPolicies) console.log(`  ${p.tablename} — ${p.policyname}`);

  console.log("\n=== Seed data counts ===");
  const roles = await sql`SELECT count(*) n FROM roles`;
  const materials = await sql`SELECT count(*) n FROM materials`;
  const products = await sql`SELECT count(*) n FROM products`;
  const prices = await sql`SELECT count(*) n FROM prices`;
  const users = await sql`SELECT email, role_code, is_active FROM users WHERE role_code='internal_admin'`;
  const resourceCats = await sql`SELECT count(*) n FROM resource_categories`;
  console.log(`  roles=${roles[0].n} materials=${materials[0].n} products=${products[0].n} prices=${prices[0].n} resource_categories=${resourceCats[0].n}`);
  console.log(`  internal_admin users:`, users);

  console.log("\n=== Storage buckets ===");
  const buckets = await sql`SELECT id, public FROM storage.buckets ORDER BY id`;
  console.log(buckets);
} finally {
  await sql.end();
}
