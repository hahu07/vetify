/**
 * Backend-owned application database — Layer 3 of the Policy-Approval
 * Security Roadmap (docs/deferred-gaps.md): human user accounts and an
 * append-only audit log for individual accountability on governance actions
 * submitted through a shared Canton party (vetify, riskCommittee).
 *
 * Distinct from pqs.ts's pool: that one connects to the "vetify-pqs"
 * database, which is Scribe-managed (Flyway migrations) and read-only from
 * this backend's perspective. This pool connects to the default "vetify"
 * database, which this backend owns and writes to directly — schema in
 * infra/postgres/init.sql's "Backend-owned application tables" section.
 */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

// Same Postgres instance as PQS by default (one docker-compose service) —
// only the database name differs — but kept as separate env vars in case a
// real deployment ever wants to split them onto different instances.
const pool = new Pool({
  host:     process.env.APP_POSTGRES_HOST     ?? process.env.PQS_POSTGRES_HOST     ?? "localhost",
  port:     parseInt(process.env.APP_POSTGRES_PORT ?? process.env.PQS_POSTGRES_PORT ?? "5432", 10),
  user:     process.env.APP_POSTGRES_USER     ?? process.env.PQS_POSTGRES_USER     ?? "vetify",
  password: process.env.APP_POSTGRES_PASSWORD ?? process.env.PQS_POSTGRES_PASSWORD ?? "vetify",
  database: process.env.APP_POSTGRES_DATABASE ?? "vetify",
  max: 10,
});

export interface GovernanceUser {
  id: number;
  username: string;
  passwordHash: string;
  displayName: string;
  partyRole: string;
  active: boolean;
  totpSecret: string | null;
  totpEnabled: boolean;
}

const USER_COLUMNS = `id, username, password_hash, display_name, party_role, active, totp_secret, totp_enabled`;

function rowToUser(row: Record<string, unknown>): GovernanceUser {
  return {
    id: row.id as number,
    username: row.username as string,
    passwordHash: row.password_hash as string,
    displayName: row.display_name as string,
    partyRole: row.party_role as string,
    active: row.active as boolean,
    totpSecret: row.totp_secret as string | null,
    totpEnabled: row.totp_enabled as boolean,
  };
}

export async function findUserByUsername(username: string): Promise<GovernanceUser | null> {
  const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE username = $1`, [username]);
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

export async function findUserById(id: number): Promise<GovernanceUser | null> {
  const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

// Layer 4: stores a freshly-generated TOTP secret without enabling it yet —
// enabling only happens once the user proves they can generate a valid code
// from it (see setTotpEnabled). If they abandon setup, totp_enabled stays
// false and password-only login keeps working — no partial-lockout risk.
export async function setTotpSecret(userId: number, secret: string): Promise<void> {
  await pool.query(`UPDATE users SET totp_secret = $2 WHERE id = $1`, [userId, secret]);
}

export async function setTotpEnabled(userId: number, enabled: boolean): Promise<void> {
  await pool.query(`UPDATE users SET totp_enabled = $2 WHERE id = $1`, [userId, enabled]);
}

export async function recordAuditLog(entry: {
  userId: number;
  username: string;
  displayName: string;
  partyRole: string;
  action: string;
  contractId?: string;
  details?: unknown;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (user_id, username, display_name, party_role, action, contract_id, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [entry.userId, entry.username, entry.displayName, entry.partyRole, entry.action, entry.contractId ?? null, entry.details ?? null],
  );
}

export interface AuditLogEntry {
  id: number;
  username: string;
  displayName: string;
  partyRole: string;
  action: string;
  contractId: string | null;
  details: unknown;
  occurredAt: string;
}

export async function listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const result = await pool.query(
    `SELECT id, username, display_name, party_role, action, contract_id, details, occurred_at
     FROM audit_log ORDER BY occurred_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    partyRole: row.party_role,
    action: row.action,
    contractId: row.contract_id,
    details: row.details,
    occurredAt: row.occurred_at,
  }));
}

// mono.co's assess_creditworthiness result is delivered via webhook, not
// returned synchronously — see infra/postgres/init.sql's creditworthiness_webhooks
// table comment and agents/src/agents/underwriting.ts for the full picture.
export interface CreditworthinessWebhookResult {
  reference: string;
  dscr: number | null;
  creditScore: number | null;
  receivedAt: string;
}

export async function recordCreditworthinessWebhook(entry: {
  reference: string;
  dscr: number | null;
  creditScore: number | null;
  rawPayload: unknown;
}): Promise<void> {
  await pool.query(
    `INSERT INTO creditworthiness_webhooks (reference, dscr, credit_score, raw_payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (reference) DO UPDATE SET
       dscr = EXCLUDED.dscr, credit_score = EXCLUDED.credit_score, raw_payload = EXCLUDED.raw_payload`,
    [entry.reference, entry.dscr, entry.creditScore, JSON.stringify(entry.rawPayload)],
  );
}

export async function getCreditworthinessWebhook(reference: string): Promise<CreditworthinessWebhookResult | null> {
  const result = await pool.query(
    `SELECT reference, dscr, credit_score, received_at FROM creditworthiness_webhooks WHERE reference = $1`,
    [reference],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    reference: row.reference,
    dscr: row.dscr,
    creditScore: row.credit_score,
    receivedAt: row.received_at,
  };
}

export { pool };
