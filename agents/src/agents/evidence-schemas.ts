/**
 * zod schemas for every evidence contract an LLM agent reports back to code
 * (review gaps G3/G13, docs/platform-review-2026-07.md). Each autonomous
 * agent's reply is validated against its schema via parseEvidence (util.ts)
 * BEFORE any deterministic scoring engine consumes it — a malformed or
 * injection-shaped reply fails loudly and no decision is made, instead of
 * `Number(garbage) = NaN` silently propagating into a score and only dying
 * at the ledger's range assertion.
 *
 * Deliberately *presence-and-type* strict but *value* tolerant where the
 * agents' existing normalizers (toAmlStatus/toKybStatus/... in verifier.ts)
 * already coerce unknown enum strings to their conservative fallback — the
 * schema guarantees shape; the normalizers keep deciding semantics.
 */
import { z } from "zod";

/** Sub-results in the verification evidence may be either the happy shape or
 * the documented error shape — both are objects; the agent-side converters
 * (toMashupResult/toCacResult/toTinResult) normalize the contents. */
const evidenceSubObject = z.record(z.unknown());

export const VerificationEvidenceSchema = z.object({
  mashup: evidenceSubObject,
  cac: evidenceSubObject,
  tin: evidenceSubObject,
});
export type VerificationEvidence = z.infer<typeof VerificationEvidenceSchema>;

// Stage 0 (financing provider registration) — reuses the same lookup_cac tool
// and toCacResult converter as Stage 2, just against a provider's own
// cacRegNumber instead of a business director's.
export const ProviderEvidenceSchema = z.object({
  cac: evidenceSubObject,
});
export type ProviderEvidence = z.infer<typeof ProviderEvidenceSchema>;

export const ComplianceEvidenceSchema = z.object({
  amlBusinessStatus: z.string(),
  amlDirectorStatus: z.string(),
  amlScreeningRef: z.string().nullish(),
  // G14: verification-ID references relayed from Youverify's own response —
  // never fabricated, null when the tool response didn't include one.
  sanctionsCheckRef: z.string().nullish(),
  pepCheckRef: z.string().nullish(),
  adverseMediaRef: z.string().nullish(),
  // G14: true specifically when a review_required status was driven by a PEP
  // match (categoryCount.pep > 0) rather than a sanctions match — the
  // aml-decision-guide's own distinction ("Only pep array populated → PEP hit
  // — always Flag"). Drives OpenEddCase, distinct from the generic ManualReview
  // flag every other ambiguous case gets.
  pepHit: z.boolean().default(false),
  adverseMediaSummary: z.string(),
  creditHistory: z.string(),
  kybStatus: z.string(),
});
export type ComplianceEvidence = z.infer<typeof ComplianceEvidenceSchema>;

export const NormalizedTransactionSchema = z.object({
  date: z.string().min(4),
  amount: z.number().nonnegative(),
  direction: z.enum(["credit", "debit"]),
  description: z.string().max(500).nullish(),
  counterparty: z.string().max(200).nullish(),
  balanceAfter: z.number().nullish(),
});

export const UnderwritingEvidenceSchema = z.object({
  transactions: z.array(NormalizedTransactionSchema).max(500),
  creditworthinessReference: z.string().nullish(),
  dscr: z.number().nullish(),
  creditScore: z.number().nullish(),
});
export type UnderwritingEvidence = z.infer<typeof UnderwritingEvidenceSchema>;

export const MonitoringEvidenceSchema = z.object({
  transactions: z.array(NormalizedTransactionSchema).max(300),
});
export type MonitoringEvidence = z.infer<typeof MonitoringEvidenceSchema>;

/** Shariah narrative (table-miss path only — the verdict is already fixed to
 * REQUIRES_REVIEW before this is parsed and cannot be changed by it). */
export const ShariahNarrativeSchema = z.object({
  reasoning: z.string().max(4000),
  citations: z.array(z.string().max(300)).max(20).default([]),
});
export type ShariahNarrative = z.infer<typeof ShariahNarrativeSchema>;
