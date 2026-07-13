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
import { readSecret } from "./secrets.js";
import { pgSslConfig } from "./pg-ssl.js";
import pg from "pg";

const { Pool } = pg;

// Same Postgres instance as PQS by default (one docker-compose service) —
// only the database name differs — but kept as separate env vars in case a
// real deployment ever wants to split them onto different instances.
const pool = new Pool({
  host:     process.env.APP_POSTGRES_HOST     ?? process.env.PQS_POSTGRES_HOST     ?? "localhost",
  port:     parseInt(process.env.APP_POSTGRES_PORT ?? process.env.PQS_POSTGRES_PORT ?? "5432", 10),
  user:     process.env.APP_POSTGRES_USER     ?? process.env.PQS_POSTGRES_USER     ?? "vetify",
  password: readSecret("APP_POSTGRES_PASSWORD") || readSecret("PQS_POSTGRES_PASSWORD") || "vetify",
  database: process.env.APP_POSTGRES_DATABASE ?? "vetify",
  max: 10,
  ssl: pgSslConfig(),
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
  failedLoginAttempts: number;
  lockedUntil: string | null;
  // Self-serve signup tenant-scoping keys (migrations/002_signup_isolation.sql)
  // — see init.sql's users table comment for what each means.
  cacRegNumber: string | null;
  cantonPartyId: string | null;
  cantonPartyJwt: string | null;
}

const USER_COLUMNS = `id, username, password_hash, display_name, party_role, active, totp_secret, totp_enabled, failed_login_attempts, locked_until, cac_reg_number, canton_party_id, canton_party_jwt`;

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
    failedLoginAttempts: row.failed_login_attempts as number,
    lockedUntil: row.locked_until ? new Date(row.locked_until as string).toISOString() : null,
    cacRegNumber: row.cac_reg_number as string | null,
    cantonPartyId: row.canton_party_id as string | null,
    cantonPartyJwt: row.canton_party_jwt as string | null,
  };
}

export async function findUserByUsername(username: string): Promise<GovernanceUser | null> {
  const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE username = $1`, [username]);
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

// Used to pre-check "is this CAC already claimed by a different account" BEFORE
// creating a Canton BusinessOnboarding contract — cac_reg_number carries a
// UNIQUE constraint (users_cac_reg_number_key), and finding out about that
// conflict only from the constraint violation (after the ledger write already
// committed) leaves an orphaned Draft behind on every retry.
export async function findUserByCacRegNumber(cacRegNumber: string): Promise<GovernanceUser | null> {
  const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE cac_reg_number = $1`, [cacRegNumber]);
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

export async function findUserById(id: number): Promise<GovernanceUser | null> {
  const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

// Self-serve signup (routes/auth.ts's POST /signup). Business signups pass
// cantonPartyId/cantonPartyJwt as null — they act through the existing shared
// "business" party, scoped later by their own CAC registration number, not a
// new Canton identity. Financer signups get a freshly-allocated party
// (canton.ts's allocateParty) recorded here.
export async function createUser(u: {
  username: string;
  passwordHash: string;
  displayName: string;
  partyRole: string;
  cantonPartyId?: string | null;
  cantonPartyJwt?: string | null;
}): Promise<GovernanceUser> {
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, display_name, party_role, canton_party_id, canton_party_jwt)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${USER_COLUMNS}`,
    [u.username, u.passwordHash, u.displayName, u.partyRole, u.cantonPartyId ?? null, u.cantonPartyJwt ?? null],
  );
  return rowToUser(result.rows[0]);
}

// Only ever sets the CAC number once (WHERE cac_reg_number IS NULL) — a
// business's tenant key is fixed at their first BusinessOnboarding creation
// and never changes after (mirrors the Daml side's "CAC number immutable"
// rule on BusinessOnboarding.Amend). Returns whether this call actually set
// it, so the caller can distinguish "first submission, now linked" from "this
// account already has a different CAC on file" and reject the latter with a
// clean 409 instead of silently ignoring the mismatch.
export async function setUserCacRegNumber(userId: number, cacRegNumber: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE users SET cac_reg_number = $2 WHERE id = $1 AND cac_reg_number IS NULL`,
    [userId, cacRegNumber],
  );
  return (result.rowCount ?? 0) > 0;
}

// Replays every existing financer's dynamically-allocated Canton party into
// canton.ts's in-memory registerDynamicParty() map at process boot — that map
// isn't persisted anywhere else, so a backend restart would otherwise strand
// every previously-signed-up FI with no resolvable party until they re-signup.
export async function listFinancerPartyRegistrations(): Promise<
  { id: number; cantonPartyId: string; cantonPartyJwt: string | null }[]
> {
  const result = await pool.query(
    `SELECT id, canton_party_id, canton_party_jwt FROM users
     WHERE party_role = 'financer' AND canton_party_id IS NOT NULL`,
  );
  return result.rows.map((row) => ({
    id: row.id as number,
    cantonPartyId: row.canton_party_id as string,
    cantonPartyJwt: row.canton_party_jwt as string | null,
  }));
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

// Persistent per-account lockout (audit finding M-2). Read-then-write rather
// than a single atomic UPDATE — deliberately: login attempts are already
// IP-rate-limited upstream (routes/auth.ts), so this isn't a high-concurrency
// path, and the straightforward version is easier to read than one dense
// CASE-laden UPDATE. A lock that has already expired is treated as a fresh
// window (the next failure starts counting from 1, not from a stale total)
// rather than needing a separate cleanup job to clear old lock state.
/** Returns the new lockedUntil if this call is the one that crossed the
 * threshold, so the caller can report the lockout on this same response
 * instead of the account looking merely "wrong password" until the next
 * attempt reveals it's actually locked (live-tested — the earlier version
 * without a return value did exactly that, one request later than it
 * should have). */
export async function recordFailedLogin(userId: number, thresholdAttempts: number, lockoutMinutes: number): Promise<Date | null> {
  const result = await pool.query(`SELECT failed_login_attempts, locked_until FROM users WHERE id = $1`, [userId]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const staleLock = row.locked_until && new Date(row.locked_until) <= new Date();
  const nextAttempts = staleLock ? 1 : row.failed_login_attempts + 1;
  const lockedUntil = nextAttempts >= thresholdAttempts ? new Date(Date.now() + lockoutMinutes * 60_000) : null;
  await pool.query(`UPDATE users SET failed_login_attempts = $2, locked_until = $3 WHERE id = $1`, [userId, nextAttempts, lockedUntil]);
  return lockedUntil;
}

export async function resetFailedLogins(userId: number): Promise<void> {
  await pool.query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [userId]);
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

// ─── Notifications ───────────────────────────────────────────────────────────
// See init.sql's notifications table comment for why this is populated by a
// PQS-watching poller (notifications.ts) rather than a hook on the
// choice-exercise routes.

export interface Notification {
  id: number;
  title: string;
  body: string;
  link: string | null;
  category: string;
  readAt: string | null;
  createdAt: string;
}

function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as number,
    title: row.title as string,
    body: row.body as string,
    link: row.link as string | null,
    category: row.category as string,
    readAt: row.read_at ? new Date(row.read_at as string).toISOString() : null,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

// ON CONFLICT DO NOTHING on the (source_contract_id, user_id) unique constraint
// is what makes the poller's full-rescan-every-tick approach idempotent — no
// separate "have I seen this contract" cursor needed.
export async function createNotificationIfNew(entry: {
  userId: number;
  title: string;
  body: string;
  link?: string;
  category: string;
  sourceContractId: string;
}): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, title, body, link, category, source_contract_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (source_contract_id, user_id) DO NOTHING`,
    [entry.userId, entry.title, entry.body, entry.link ?? null, entry.category, entry.sourceContractId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listNotificationsForUser(userId: number, limit = 50): Promise<Notification[]> {
  const result = await pool.query(
    `SELECT id, title, body, link, category, read_at, created_at FROM notifications
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map(rowToNotification);
}

export async function countUnreadNotifications(userId: number): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return result.rows[0].n as number;
}

// Scoped to (id, userId) together — a user can only ever mark their own
// notification read, never guess another account's notification id.
export async function markNotificationRead(id: number, userId: number): Promise<boolean> {
  const result = await pool.query(
    `UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  await pool.query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
}

// Financer recipient resolution mirrors financing.ts's own established fallback:
// a self-serve signup's dynamically-allocated party matches canton_party_id
// directly; the legacy/demo fi@vetify.ng-style account(s) (canton_party_id IS
// NULL) fall through to "sees everything unscoped" for the same reason those
// routes do — there's no real per-institution identity to match against for
// the shared static FinancialInstitution party.
export async function findFinancerRecipients(financialInstitutionPartyId: string): Promise<GovernanceUser[]> {
  const byParty = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users WHERE party_role = 'financer' AND canton_party_id = $1`,
    [financialInstitutionPartyId],
  );
  if (byParty.rows.length > 0) return byParty.rows.map(rowToUser);
  const legacy = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users WHERE party_role = 'financer' AND canton_party_id IS NULL`,
  );
  return legacy.rows.map(rowToUser);
}

export { pool };
