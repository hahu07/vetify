/**
 * PQS (Participant Query Store) client.
 *
 * Connects to the PostgreSQL database populated by the Scribe service.
 * Exposes a typed `active()` helper that mirrors the PQS SQL function:
 *   SELECT contract_id, payload FROM active('<templateId>') [WHERE ...]
 *
 * Payloads are stored as JSONB; Daml types encode as follows:
 *   Int64, Decimal, ContractId  → strings
 *   List                        → JSON arrays
 *   Record                      → JSON objects
 *   Enum                        → strings  (e.g. "Active", "Delinquent")
 *   Optional Some x             → x
 *   Optional None               → null
 */
import "dotenv/config";
import { readSecret } from "./secrets.js";
import { pgSslConfig } from "./pg-ssl.js";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.PQS_POSTGRES_HOST     ?? "localhost",
  port:     parseInt(process.env.PQS_POSTGRES_PORT ?? "5432", 10),
  user:     process.env.PQS_POSTGRES_USER     ?? "vetify",
  password: readSecret("PQS_POSTGRES_PASSWORD") || "vetify",
  database: process.env.PQS_POSTGRES_DATABASE ?? "vetify-pqs",
  max: 10,
  ssl: pgSslConfig(),
});

export interface PqsContract<T = Record<string, unknown>> {
  contractId: string;
  payload:    T;
}

// G12: pagination. `limit`/`offset` are clamped by clampPage; callers on
// route handlers derive them from ?limit=&offset= query params.
export interface Page {
  limit:  number;
  offset: number;
}

const MAX_PAGE_LIMIT = 200;
const DEFAULT_PAGE_LIMIT = 50;

/** Clamp untrusted ?limit/&offset into a safe Page (defends against unbounded pulls). */
export function clampPage(limit?: unknown, offset?: unknown): Page {
  const l = Number(limit);
  const o = Number(offset);
  return {
    limit:  Number.isFinite(l) ? Math.min(Math.max(Math.trunc(l), 1), MAX_PAGE_LIMIT) : DEFAULT_PAGE_LIMIT,
    offset: Number.isFinite(o) ? Math.max(Math.trunc(o), 0) : 0,
  };
}

export interface PagedResult<T = Record<string, unknown>> {
  rows:    PqsContract<T>[];
  limit:   number;
  offset:  number;
  hasMore: boolean;  // true if more rows exist past this page (fetched limit+1 to detect)
}

/**
 * Paginated variant of active(): pushes LIMIT/OFFSET down to Postgres instead of
 * pulling the whole template ACS into the process (review gap G12). Fetches one
 * extra row to compute `hasMore` without a second COUNT query.
 * @param where   optional WHERE clause; its bind params start at $2 ($1 is templateId).
 *                LIMIT/OFFSET are appended as the last two params automatically.
 */
export async function activePaged<T = Record<string, unknown>>(
  templateId: string,
  page: Page,
  where?: string,
  ...params: unknown[]
): Promise<PagedResult<T>> {
  const limitIdx  = params.length + 2;   // $1 = templateId, then WHERE params, then LIMIT/OFFSET
  const offsetIdx = params.length + 3;
  const base = where
    ? `SELECT contract_id, payload FROM active($1) WHERE ${where}`
    : `SELECT contract_id, payload FROM active($1)`;
  const sql = `${base} LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
  // fetch one extra to detect a further page
  const values = [templateId, ...params, page.limit + 1, page.offset];
  const result = await pool.query(sql, values);
  const rows = result.rows.slice(0, page.limit).map((row) => ({
    contractId: row.contract_id as string,
    payload:    row.payload     as T,
  }));
  return { rows, limit: page.limit, offset: page.offset, hasMore: result.rows.length > page.limit };
}

/**
 * Query active contracts of a given template.
 * @param templateId  e.g. "Vetify.Murabahah:MurabahahContract"
 * @param where       optional SQL WHERE clause (without the keyword), e.g. "payload->>'status' = $2"
 * @param params      bind parameters for the WHERE clause (first param is always the templateId)
 */
export async function active<T = Record<string, unknown>>(
  templateId: string,
  where?: string,
  ...params: unknown[]
): Promise<PqsContract<T>[]> {
  const sql = where
    ? `SELECT contract_id, payload FROM active($1) WHERE ${where}`
    : `SELECT contract_id, payload FROM active($1)`;

  const values = [templateId, ...params];
  const result = await pool.query(sql, values);

  return result.rows.map((row) => ({
    contractId: row.contract_id as string,
    payload:    row.payload    as T,
  }));
}

/**
 * Query the *most recently archived* contract of a given template matching
 * `where` — the archived-history counterpart to `active()`. Scribe/PQS keeps
 * full archived-contract payloads (confirmed live via its `archives()` SQL
 * function, not just `active()`'s live set), so data that only ever existed
 * on a since-archived contract (e.g. BusinessOnboarding.documents, gone from
 * `active()` the instant Approve/Reject archives it — Onboarding.daml
 * deliberately doesn't recreate that contract) is still recoverable here.
 * Ordered by `archived_at_offset DESC` so a CAC with multiple past
 * generations (amendments, recertification) resolves to the latest one.
 */
export async function latestArchived<T = Record<string, unknown>>(
  templateId: string,
  where?: string,
  ...params: unknown[]
): Promise<PqsContract<T> | null> {
  const sql = where
    ? `SELECT contract_id, payload FROM archives($1) WHERE ${where} ORDER BY archived_at_offset DESC LIMIT 1`
    : `SELECT contract_id, payload FROM archives($1) ORDER BY archived_at_offset DESC LIMIT 1`;

  const values = [templateId, ...params];
  const result = await pool.query(sql, values);
  if (result.rows.length === 0) return null;

  return {
    contractId: result.rows[0].contract_id as string,
    payload:    result.rows[0].payload    as T,
  };
}

/**
 * Query a single contract by contract ID.
 */
export async function contractById<T = Record<string, unknown>>(
  templateId: string,
  contractId: string,
): Promise<PqsContract<T> | null> {
  const result = await pool.query(
    `SELECT contract_id, payload FROM active($1) WHERE contract_id = $2`,
    [templateId, contractId],
  );
  if (result.rows.length === 0) return null;
  return {
    contractId: result.rows[0].contract_id as string,
    payload:    result.rows[0].payload     as T,
  };
}

/**
 * Read-your-writes mitigation (review gap G12): PQS is populated by Scribe from the
 * ledger's transaction stream, which lags the ledger itself — a client that writes a
 * contract via canton.ts and then immediately GETs it by ID here can race Scribe's
 * catch-up (typically well under a second locally, but not zero). A single lookup-by-ID
 * is exactly the case this matters for — a client following up on its own just-completed
 * write, not a general list scan — so a short bounded retry (not a poll loop; no retry
 * on a genuine 404 for a contract that never existed, since the caller waits the same
 * short window it would anyway) is the pragmatic fix, rather than a second read path
 * against the ledger's JSON API that would need its own live verification cycle.
 */
export async function contractByIdWithRetry<T = Record<string, unknown>>(
  templateId: string,
  contractId: string,
  attempts = 3,
  delayMs = 150,
): Promise<PqsContract<T> | null> {
  for (let i = 0; i < attempts; i++) {
    const found = await contractById<T>(templateId, contractId);
    if (found) return found;
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

/**
 * Run an arbitrary SQL query against PQS (for aggregations, joins, etc.).
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export { pool };
