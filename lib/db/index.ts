import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Service-role DB connection used for all server-side queries.
 *
 * Architecture note: this project uses the Supabase transaction-mode pooler
 * (port 6543, IPv4), which does not support session-level SET commands needed
 * for per-request RLS claim injection. All data access therefore runs through
 * the service-role connection with explicit application-level authorization
 * enforced by `lib/authz/policy.ts` and scoped WHERE clauses in each service
 * function. The RLS policies in the migration serve as defense-in-depth for
 * any direct DB or future PostgREST access.
 *
 * If a session-mode pooler URL becomes available, the per-request RLS pattern
 * described in REBUILD_PLAN.md can be layered in without changing call sites.
 */
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  // Bound connection setup and idle reclaim so a flaky network path fails
  // fast instead of holding a pool slot indefinitely.
  connect_timeout: 10,
  idle_timeout: 20,
  // Server-side statement_timeout ensures a query that hangs mid-flight
  // (e.g. packets dropped after the connection is established) gets
  // cancelled by Postgres and its connection freed back to the pool,
  // rather than blocking that slot forever — which otherwise cascades
  // into the whole pool queueing indefinitely behind stuck connections.
  connection: {
    statement_timeout: 15_000,
  },
});

export const db = drizzle(client, { schema });
