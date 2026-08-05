import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const roles = await sql`SELECT role_code, is_internal FROM public.roles ORDER BY is_internal DESC, role_code`;
console.log("Roles seeded:", roles.map((r) => r.role_code).join(", "));

const users = await sql`SELECT id, email, role_code, auth_user_id IS NOT NULL AS linked FROM public.users`;
console.log("Users:", JSON.stringify(users, null, 2));

await sql.end();
