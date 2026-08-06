import postgres from "postgres";

const { DATABASE_URL } = process.env;
const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });

try {
  const pubTables = await sql`
    SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    AND tablename IN ('production_work_orders','production_line_progress','notifications')
    ORDER BY tablename;
  `;
  console.log("Realtime publication tables:", pubTables.map((r) => r.tablename));

  const policies = await sql`
    SELECT tablename, policyname, roles FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('notifications','notification_reads','resources','resource_categories','resource_versions','production_work_orders','production_line_progress')
    ORDER BY tablename, policyname;
  `;
  console.log(`\nRLS policies (${policies.length}):`);
  for (const p of policies) console.log(`  ${p.tablename} — ${p.policyname} (${p.roles})`);

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN
    ('notifications','notification_reads','resource_categories','resources','resource_versions')
    ORDER BY table_name;
  `;
  console.log("\nNew tables present:", tables.map((r) => r.table_name));

  const bucket = await sql`SELECT id, public FROM storage.buckets WHERE id = 'resources';`;
  console.log("\nStorage bucket:", bucket);
} finally {
  await sql.end();
}
