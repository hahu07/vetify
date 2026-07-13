/**
 * Boot-time configuration validation (review gap G7, docs/platform-review-2026-07.md).
 *
 * Every silent `process.env.X ?? "<fallback>"` in this package was a latent
 * runtime bug waiting for the ledger to reject it — most acutely
 * CANTON_FI_PARTY defaulting to the *role name* "financialInstitution",
 * which reporting.ts then wrote into PortfolioReport.financialInstitution
 * (a field that needs a real Party ID), and CANTON_ADVISOR_PARTY_ID
 * defaulting to "" in verifier.ts's ComplianceReview creation. Both failures
 * only surfaced deep inside a ledger command, long after startup.
 *
 * This module fails fast instead: the Supervisor/ACP entry points call
 * validateAgentsConfig() before doing anything, and it throws with the full
 * list of missing/placeholder values. Values copied verbatim from
 * .env.example (e.g. "Assessor::...") are treated as missing, not present.
 */

import { logger } from "./logger.js";

const PLACEHOLDER_SUFFIX = "::...";

function readPartyId(envKey: string): string | undefined {
  const value = process.env[envKey];
  if (!value || value.endsWith(PLACEHOLDER_SUFFIX)) return undefined;
  return value;
}

export interface AgentsConfig {
  vetifyPartyId: string;
  verifierPartyId: string;
  assessorPartyId: string;
  sentinelPartyId: string;
  advisorPartyId: string;
  /** Real Party ID for the FI — written into PortfolioReport payloads. */
  fiPartyId: string;
  /** Optional: PortfolioReport.regulator is `Optional Party` on-ledger. */
  regulatorPartyId: string | null;
}

let cached: AgentsConfig | null = null;

/** Throws with a complete list of problems rather than failing one at a time. */
export function validateAgentsConfig(): AgentsConfig {
  if (cached) return cached;

  const missing: string[] = [];
  const require = (key: string): string => {
    const v = readPartyId(key);
    if (!v) missing.push(key);
    return v ?? "";
  };

  const config: AgentsConfig = {
    vetifyPartyId:   require("CANTON_VETIFY_PARTY_ID"),
    verifierPartyId: require("CANTON_VERIFIER_PARTY_ID"),
    assessorPartyId: require("CANTON_ASSESSOR_PARTY_ID"),
    sentinelPartyId: require("CANTON_SENTINEL_PARTY_ID"),
    advisorPartyId:  require("CANTON_ADVISOR_PARTY_ID"),
    fiPartyId:       require("CANTON_FI_PARTY_ID"),
    regulatorPartyId: readPartyId("CANTON_REGULATOR_PARTY_ID") ?? null,
  };

  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Agents configuration is incomplete — set the following in agents/.env ` +
      `(values still matching .env.example placeholders like "X::..." count as unset):\n` +
      missing.map((k) => `  - ${k}`).join("\n") +
      `\nParty IDs come from allocating each party once against the target participant ` +
      `(POST /v2/parties) — see agents/.env.example.`
    );
  }

  // JWTs are legitimately absent against a no-auth dev sandbox — warn, don't fail.
  const jwtKeys = ["CANTON_VETIFY_JWT", "CANTON_VERIFIER_JWT", "CANTON_ASSESSOR_JWT", "CANTON_SENTINEL_JWT", "CANTON_ADVISOR_JWT"];
  const missingJwts = jwtKeys.filter((k) => !process.env[k]);
  if (missingJwts.length > 0) {
    logger.warn(
      { missingJwts },
      `No JWT configured for: ${missingJwts.join(", ")} — fine against a no-auth local sandbox, ` +
      `fatal against any ledger with auth enabled`,
    );
  }

  cached = config;
  return config;
}
