/**
 * Forces Node's DNS resolver to prefer IPv4 over IPv6 for outbound
 * connections (Supabase Postgres pooler, Supabase Auth/Storage APIs).
 *
 * On networks where IPv6 is advertised but not actually routable, Node's
 * default "IPv6 first" resolution order causes every new connection to hang
 * until the IPv6 attempt times out (10-30s) before falling back to IPv4 —
 * manifesting as random multi-second page hangs and dev-server
 * "destination stream closed early" errors.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
