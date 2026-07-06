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
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.PQS_POSTGRES_HOST     ?? "localhost",
  port:     parseInt(process.env.PQS_POSTGRES_PORT ?? "5432", 10),
  user:     process.env.PQS_POSTGRES_USER     ?? "vetify",
  password: process.env.PQS_POSTGRES_PASSWORD ?? "vetify",
  database: process.env.PQS_POSTGRES_DATABASE ?? "vetify-pqs",
  max: 10,
});

export interface PqsContract<T = Record<string, unknown>> {
  contractId: string;
  payload:    T;
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
