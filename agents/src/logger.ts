/**
 * Structured logging (audit finding C-2, Phase 3 Enterprise Production
 * Readiness Audit, 2026-07-08) — agents-side counterpart to
 * backend/src/logger.ts. The Supervisor's poll loop and the MCP servers
 * previously logged only via plain console.*; this makes every line
 * structured JSON on stdout, level-controlled via LOG_LEVEL. It does not
 * stand up LangSmith tracing (already env-gated, see agents/.env.example)
 * or a metrics/dashboard layer — both are separate, real-infrastructure
 * concerns tracked in docs/phase2-tranche-b-design.md.
 *
 * One-shot CLI scripts (src/rag/shariah/ingest.ts, and the backend's
 * seedUsers.ts) are deliberately left on plain console.log — they're
 * interactive terminal tools a human runs and reads directly, not part of
 * a running service whose output needs to be machine-parseable.
 */
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "vetify-agents" },
});
