/**
 * Optional TLS for the two Postgres connections (appdb.ts, pqs.ts) — a gap
 * called out in the Security Audit section of the Phase 3 Enterprise
 * Production Readiness Audit (2026-07-08) but not wired up at the time.
 *
 * Off by default on purpose: docker-compose.yml's local `postgres` service
 * has no TLS listener configured, so defaulting this to "on" would break
 * every local/dev/CI run for no benefit — there's no real network between
 * this backend and that container to eavesdrop on. Set PGSSL=1 for any
 * deployment where Postgres is reached over a real network (a managed
 * Postgres service, a separate host) that has TLS configured on its end. If
 * that server's certificate isn't in the OS trust store (self-signed, or a
 * private CA), also set PGSSL_CA_FILE to its path.
 */
import { readFileSync } from "node:fs";

export function pgSslConfig(): { rejectUnauthorized: boolean; ca?: string } | undefined {
  if (process.env.PGSSL !== "1") return undefined;
  const caFile = process.env.PGSSL_CA_FILE;
  return {
    rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== "0",
    ca: caFile ? readFileSync(caFile, "utf8") : undefined,
  };
}
