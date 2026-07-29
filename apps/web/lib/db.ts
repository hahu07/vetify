import { Pool, type PoolClient } from "pg";

// Deliberately APP_POSTGRES_* here, not WEB_POSTGRES_* -- the latter is the
// migration-owning superuser, which has BYPASSRLS and would silently defeat
// every RLS policy below (see migrations/002_app_role.sql for how this was
// caught). Request-serving connections must use the restricted app role.
const pool = new Pool({
  host: process.env.WEB_POSTGRES_HOST ?? "localhost",
  port: Number(process.env.WEB_POSTGRES_PORT ?? 5434),
  user: process.env.APP_POSTGRES_USER ?? "vetify_web_app",
  password: process.env.APP_POSTGRES_PASSWORD ?? "vetify_web_app",
  database: process.env.WEB_POSTGRES_DATABASE ?? "vetify_web",
});

// Addendum C action item (web2-migration-design.md, "Phase 1 Vertical Slice
// -- Results", bug #1): a superuser/BYPASSRLS connection makes every RLS
// policy pass silently, with no error at query time -- the failure mode is
// total and undetectable from application code alone.
//
// Deliberately NOT a pool.on("connect", ...) listener: pg does not await
// that listener before handing the client back to whoever called
// pool.connect() -- an async listener runs concurrently with the caller's
// own queries on the *same* client object, which is exactly the "client is
// already executing a query" race pg's own deprecation warning flags
// (confirmed live while building this check). Using pool.query() here
// instead checks out its own client, runs one query, and releases it --
// no shared client, no race -- and the memoized promise means every
// caller of withTransaction awaits the same single check rather than
// re-querying pg_roles on every request.
let invariantChecked: Promise<void> | null = null;

function ensureNonSuperuser(): Promise<void> {
  if (!invariantChecked) {
    invariantChecked = pool
      .query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
      .then(({ rows }) => {
        const role = rows[0];
        if (!role || role.rolsuper || role.rolbypassrls) {
          throw new Error(
            `Database connection is using a role with rolsuper=${role?.rolsuper} rolbypassrls=${role?.rolbypassrls} -- ` +
              "this would silently defeat every RLS policy. Set APP_POSTGRES_USER to a NOSUPERUSER/NOBYPASSRLS role (see migrations/002_app_role.sql).",
          );
        }
      });
  }
  return invariantChecked;
}

export type PartyRole = "business" | "vetify" | "verifier" | "assessor" | "financialInstitution" | "advisor" | "sentinel" | "regulator" | "riskCommittee";

export interface SessionContext {
  userId: number;
  username: string;
  displayName: string;
  partyRole: PartyRole;
  cacRegNumber: string | null;
}

/**
 * Every domain-function write MUST go through this — it's the only place
 * that opens a transaction, sets the RLS session GUCs (SET LOCAL, pool-safe
 * per web2-migration-design.md §2), and guarantees rollback on throw. This
 * closes the "forgot to wrap it" atomicity gap named in addendum D: a
 * domain function that calls pool.query() directly instead of going through
 * here has no atomicity guarantee and skips RLS scoping entirely.
 */
export async function withTransaction<T>(
  session: SessionContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  await ensureNonSuperuser();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_party_role', $1, true)", [
      session.partyRole,
    ]);
    await client.query(
      "SELECT set_config('app.current_cac_reg_number', $1, true)",
      [session.cacRegNumber ?? ""],
    );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
