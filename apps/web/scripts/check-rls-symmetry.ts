import { Client } from "pg";
import "dotenv/config";

/**
 * Automates the single most-recurring lesson from this migration's RLS work
 * (docs/web2-migration-design.md's "Overall Readiness Assessment"): Postgres
 * RLS's `INSERT ... RETURNING` re-reads the written row through the table's
 * SELECT policy, not just the INSERT policy's WITH CHECK. Any role that can
 * INSERT or UPDATE a row but isn't also covered by that table's SELECT
 * policy will see a confusing RLS violation on the RETURNING step, even
 * though its own write's WITH CHECK passed — first found in Phase 1
 * (approved_business), then independently twice more in Stage 9-10
 * (murabahah_contract, audit_event). Three independent discoveries of the
 * same bug class is what promoted this from "a lesson" to this script.
 *
 * Approach: read every RLS policy from pg_policies, extract the role
 * literals each policy's qual/with_check compares `app.current_party_role`
 * against, and flag any table where a role covered by an INSERT/UPDATE
 * policy is missing from that table's SELECT policy.
 *
 * This is a role-symmetry check, not a full RLS correctness prover — it
 * can't catch every possible RLS bug (e.g. an overly *narrow* SELECT policy
 * that's merely inconvenient, not wrong), but it mechanically catches
 * exactly the recurring failure mode named above.
 */

const CURRENT_SETTING_CALLS = [
  /current_setting\('app\.current_party_role'::text,\s*true\)/g,
  /current_setting\('app\.current_cac_reg_number'::text,\s*true\)/g,
];

function extractRoles(expr: string | null): Set<string> {
  if (!expr) return new Set();
  let cleaned = expr;
  for (const re of CURRENT_SETTING_CALLS) cleaned = cleaned.replace(re, "");
  const roles = new Set<string>();
  const matches = cleaned.matchAll(/'([a-zA-Z]+)'/g);
  for (const m of matches) roles.add(m[1]);
  return roles;
}

interface PolicyRow {
  tablename: string;
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

async function main() {
  const client = new Client({
    host: process.env.WEB_POSTGRES_HOST ?? "localhost",
    port: Number(process.env.WEB_POSTGRES_PORT ?? 5434),
    user: process.env.WEB_POSTGRES_USER ?? "vetify_web",
    password: process.env.WEB_POSTGRES_PASSWORD ?? "vetify_web",
    database: process.env.WEB_POSTGRES_DATABASE ?? "vetify_web",
  });
  await client.connect();

  const { rows } = await client.query<PolicyRow>(
    `SELECT tablename, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename`,
  );
  await client.end();

  const byTable = new Map<string, PolicyRow[]>();
  for (const row of rows) {
    if (!byTable.has(row.tablename)) byTable.set(row.tablename, []);
    byTable.get(row.tablename)!.push(row);
  }

  let violations = 0;
  for (const [table, policies] of byTable) {
    const selectRoles = new Set<string>();
    const writeRoles = new Set<string>();

    for (const p of policies) {
      const cmd = p.cmd.toUpperCase();
      const roles = new Set([...extractRoles(p.qual), ...extractRoles(p.with_check)]);
      if (cmd === "SELECT" || cmd === "ALL") for (const r of roles) selectRoles.add(r);
      if (cmd === "INSERT" || cmd === "UPDATE" || cmd === "ALL") for (const r of roles) writeRoles.add(r);
    }

    const missing = [...writeRoles].filter((r) => !selectRoles.has(r));
    if (missing.length > 0) {
      violations++;
      console.error(
        `[FAIL] ${table}: role(s) [${missing.join(", ")}] can INSERT/UPDATE but are not covered by the SELECT policy ` +
          `-- an INSERT ... RETURNING (or UPDATE ... RETURNING) as that role will fail RLS on the RETURNING step.`,
      );
    }
  }

  if (violations === 0) {
    console.log(`OK: all ${byTable.size} tables' write roles are covered by their own SELECT policy.`);
    process.exit(0);
  } else {
    console.error(`\n${violations} table(s) failed the RLS write/select symmetry check.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
