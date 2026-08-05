/**
 * Apply a SQL migration file to the Supabase Postgres database.
 *
 * Usage: node --env-file=.env.local scripts/run-migration.mjs <path>
 * Example: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0002_catalog_materials.sql
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve } from "path";

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("❌  Usage: node --env-file=.env.local scripts/run-migration.mjs <path-to-sql>");
  process.exit(1);
}

const sqlText = readFileSync(resolve(file), "utf-8");
const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });

try {
  console.log(`⏳  Applying migration: ${file}`);
  await sql.unsafe(sqlText);
  console.log("✅  Migration applied successfully.");
} catch (err) {
  console.error("❌  Migration failed:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
