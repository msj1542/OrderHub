import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Service-role DB connection (migrations, seeding, admin scripts).
 * Request-scoped queries that must honor RLS get their own per-request
 * client with JWT claims set — added alongside the users/companies schema
 * in Phase 1.
 */
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, { schema });
