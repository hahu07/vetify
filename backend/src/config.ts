/**
 * Boot-time configuration validation (review gap G7, docs/platform-review-2026-07.md).
 *
 * The backend is more forgiving than the agents package: its read routes
 * (PQS-backed GETs) genuinely work with zero Canton configuration, and
 * canton.ts's partyId() already throws per-call on a missing Party ID — so a
 * missing value here can't silently corrupt a payload the way the agents'
 * old `?? "financialInstitution"` fallback could. Dev therefore gets loud
 * warnings; production (NODE_ENV=production, or STRICT_CONFIG=1 anywhere)
 * gets a hard failure at startup instead of the first 500 at request time.
 *
 * Party ID completeness and CORS_ORIGIN wildcard use that same isStrict()
 * gate — deliberately lenient outside production/STRICT_CONFIG, for the
 * functional reasons above.
 *
 * The session secret gets a *narrower* gate on purpose (audit finding M-1,
 * Phase 3 Enterprise Production Readiness Audit, 2026-07-08): isStrict()
 * alone left any NODE_ENV value other than exactly "production" — staging,
 * demo, or simply unset — running silently on a hardcoded, publicly-known
 * JWT signing secret. A forgeable session secret is a live vulnerability the
 * moment the server accepts a connection, not something that should ever
 * depend on remembering to also set STRICT_CONFIG. So the dev placeholder is
 * refused unconditionally unless NODE_ENV is a recognized local/dev value —
 * there is no separate STRICT_CONFIG opt-out for this one.
 */
import "dotenv/config";
import { logger } from "./logger.js";

const PLACEHOLDER_SUFFIX = "::...";
const DEV_SESSION_SECRET = "dev-only-insecure-secret-change-me";
const DEV_ENVIRONMENTS = new Set(["development", "test"]);

const PARTY_ID_KEYS = [
  "CANTON_BUSINESS_PARTY_ID",
  "CANTON_VETIFY_PARTY_ID",
  "CANTON_VERIFIER_PARTY_ID",
  "CANTON_ASSESSOR_PARTY_ID",
  "CANTON_SENTINEL_PARTY_ID",
  "CANTON_ADVISOR_PARTY_ID",
  "CANTON_FI_PARTY_ID",
  "CANTON_REGULATOR_PARTY_ID",
  "CANTON_RISK_COMMITTEE_PARTY_ID",
] as const;

function isStrict(): boolean {
  return process.env.NODE_ENV === "production" || process.env.STRICT_CONFIG === "1";
}

/** Recognized local/test environments — the only ones exempt from the
 * unconditional session-secret check below. An unset or unrecognized
 * NODE_ENV (e.g. "staging", a typo, or simply forgetting to set it) is
 * deliberately treated as "not safe", not as "assume dev". */
export function isRecognizedDevEnvironment(): boolean {
  const env = process.env.NODE_ENV;
  return env !== undefined && DEV_ENVIRONMENTS.has(env);
}

export function validateBackendConfig(): void {
  const problems: string[] = [];

  for (const key of PARTY_ID_KEYS) {
    const value = process.env[key];
    if (!value) problems.push(`${key} is unset`);
    else if (value.endsWith(PLACEHOLDER_SUFFIX)) problems.push(`${key} still matches the .env.example placeholder ("${value}")`);
  }

  if (process.env.CORS_ORIGIN === "*") {
    problems.push(`CORS_ORIGIN is "*" — any origin may call this API with a valid bearer token`);
  }

  if (problems.length > 0) {
    const report = `Backend configuration problems:\n` + problems.map((p) => `  - ${p}`).join("\n");
    if (isStrict()) {
      throw new Error(report + `\nRefusing to start (NODE_ENV=production / STRICT_CONFIG=1).`);
    }
    logger.warn({ problems }, "Continuing in dev mode — ledger writes touching unset parties will fail per-request");
  }

  const sessionSecret = process.env.SESSION_JWT_SECRET ?? DEV_SESSION_SECRET;
  if (sessionSecret === DEV_SESSION_SECRET && !isRecognizedDevEnvironment()) {
    throw new Error(
      `SESSION_JWT_SECRET is unset (or still the dev placeholder), and NODE_ENV ` +
      `("${process.env.NODE_ENV ?? "unset"}") is not a recognized local environment ` +
      `(development/test). Refusing to start with a forgeable, publicly-known ` +
      `session-signing secret — set SESSION_JWT_SECRET (or SESSION_JWT_SECRET_FILE), ` +
      `or set NODE_ENV=development for local work.`,
    );
  }
  if (sessionSecret === DEV_SESSION_SECRET) {
    logger.warn({ nodeEnv: process.env.NODE_ENV }, "SESSION_JWT_SECRET is the dev placeholder — allowed only because NODE_ENV is a recognized dev/test environment");
  }
}
