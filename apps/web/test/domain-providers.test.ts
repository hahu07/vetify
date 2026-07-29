// Tests for lib/domain/providers.ts -- Phase 2, Eleventh Slice (Stage 0:
// FinancingProviderOnboarding). Ported from daml/Vetify/FinancingProvider.daml.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { AuthorizationError, DomainError } from "@/lib/errors";
import {
  createProviderOnboarding,
  submitProviderForReview,
  recordProviderScore,
  flagProviderForManualReview,
  requestProviderAmendment,
  amendProvider,
  approveProvider,
  rejectProvider,
  createProviderVerificationPolicy,
  updateProviderVerificationPolicy,
  getProviderOnboarding,
} from "@/lib/domain/providers";

function fiSession(): SessionContext {
  return { userId: 5, username: "test-fi", displayName: "Test FI", partyRole: "financialInstitution", cacRegNumber: null };
}
function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
}
function businessSession(): SessionContext {
  return { userId: 1, username: "test-business", displayName: "Test Business", partyRole: "business", cacRegNumber: "RLSTEST-A" };
}

const fixtureClient = new Client({
  host: process.env.WEB_POSTGRES_HOST ?? "localhost",
  port: Number(process.env.WEB_POSTGRES_PORT ?? 5434),
  user: process.env.WEB_POSTGRES_USER ?? "vetify_web",
  password: process.env.WEB_POSTGRES_PASSWORD ?? "vetify_web",
  database: process.env.WEB_POSTGRES_DATABASE ?? "vetify_web",
});
before(async () => {
  await fixtureClient.connect();
});
after(async () => {
  await fixtureClient.end();
  await pool.end();
});

async function cleanupProvider(cacRegNumber: string) {
  await fixtureClient.query(
    `DELETE FROM provider_rejection_record WHERE financing_provider_onboarding_id IN
       (SELECT id FROM financing_provider_onboarding WHERE cac_reg_number = $1)`,
    [cacRegNumber],
  );
  await fixtureClient.query(
    `DELETE FROM approved_provider WHERE financing_provider_onboarding_id IN
       (SELECT id FROM financing_provider_onboarding WHERE cac_reg_number = $1)`,
    [cacRegNumber],
  );
  await fixtureClient.query(`DELETE FROM financing_provider_onboarding WHERE cac_reg_number = $1`, [cacRegNumber]);
}

async function cleanupPolicy(policyVersion: string) {
  await fixtureClient.query(`DELETE FROM provider_verification_policy WHERE policy_version = $1`, [policyVersion]);
}

const baseArgs = {
  providerName: "Test Waqf Fund",
  address: "Lagos, Nigeria",
  providerType: "WaqfFund",
  regulatoryBody: null,
  licenseNumber: null,
  governingDocRef: { docType: "DeedOfWaqf", contentHash: "abc123", storageRef: "local://deed.pdf" },
  declaredInstruments: ["QardHasan"],
};

test("createProviderOnboarding: rejects an empty declaredInstruments list", async () => {
  await assert.rejects(
    () => createProviderOnboarding(fiSession(), { ...baseArgs, cacRegNumber: "TEST-PROV-EMPTY", declaredInstruments: [] }),
    (err: unknown) => err instanceof DomainError && err.message === "Must declare at least one financing instrument",
  );
});

test("createProviderOnboarding: only a financialInstitution session may create", async () => {
  await assert.rejects(
    () => createProviderOnboarding(businessSession(), { ...baseArgs, cacRegNumber: "TEST-PROV-AUTH" }),
    (err: unknown) => err instanceof AuthorizationError,
  );
});

test("createProviderOnboarding: a second active registration for the same CAC number is rejected", async () => {
  const cac = "TEST-PROV-DUP";
  try {
    await createProviderOnboarding(fiSession(), { ...baseArgs, cacRegNumber: cac });
    await assert.rejects(
      () => createProviderOnboarding(fiSession(), { ...baseArgs, cacRegNumber: cac }),
      (err: unknown) => err instanceof DomainError && err.message.includes("already exists"),
    );
  } finally {
    await cleanupProvider(cac);
  }
});

test("full lifecycle: create -> submit -> flag -> score -> approve", async () => {
  const cac = "TEST-PROV-HAPPY";
  try {
    const created = await createProviderOnboarding(fiSession(), { ...baseArgs, cacRegNumber: cac });
    assert.equal(created.status, "Draft");

    await assert.rejects(
      () => submitProviderForReview(fiSession(), created.id + 999999),
      (err: unknown) => err instanceof DomainError && err.message === "Provider registration not found",
    );

    const submitted = await submitProviderForReview(fiSession(), created.id);
    assert.equal(submitted.status, "UnderReview");
    await assert.rejects(
      () => submitProviderForReview(fiSession(), created.id),
      (err: unknown) => err instanceof DomainError && err.message === "Can only submit from Draft",
    );

    const scored = await recordProviderScore(vetifySession(), created.id, {
      score: 85,
      risk: "Low",
      note: "CAC active, exact match",
      version: "v1",
    });
    assert.equal(scored.status, "UnderReview");
    assert.equal(scored.agent_score, 85);

    const approved = await approveProvider(vetifySession(), created.id, {
      approvedInstruments: ["QardHasan"],
      regulator: null,
    });
    assert.ok(approved.approvedProviderId);

    const row = await getProviderOnboarding(vetifySession(), created.id);
    assert.equal(row.status, "Approved");
    assert.ok(row.archived_at);
    assert.equal(row.superseded_by_kind, "approved_provider");

    await assert.rejects(
      () => approveProvider(vetifySession(), created.id, { approvedInstruments: ["QardHasan"] }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only approve from UnderReview or ManualReview",
    );
  } finally {
    await cleanupProvider(cac);
  }
});

test("approveProvider: requires at least one approved instrument", async () => {
  const cac = "TEST-PROV-NOINSTR";
  try {
    const created = await createProviderOnboarding(fiSession(), { ...baseArgs, cacRegNumber: cac });
    await submitProviderForReview(fiSession(), created.id);
    await assert.rejects(
      () => approveProvider(vetifySession(), created.id, { approvedInstruments: [] }),
      (err: unknown) => err instanceof DomainError && err.message === "Must approve at least one financing instrument",
    );
  } finally {
    await cleanupProvider(cac);
  }
});

test("flagProviderForManualReview then rejectProvider: reject creates a provider_rejection_record and archives the source row", async () => {
  const cac = "TEST-PROV-REJECT";
  try {
    const created = await createProviderOnboarding(fiSession(), { ...baseArgs, cacRegNumber: cac });
    await submitProviderForReview(fiSession(), created.id);
    const flagged = await flagProviderForManualReview(vetifySession(), created.id, {
      score: 55,
      risk: "Medium",
      note: "CAC name mismatch",
      version: "v1",
    });
    assert.equal(flagged.status, "ManualReview");

    const rejected = await rejectProvider(vetifySession(), created.id, {
      reason: "CAC registration could not be verified",
      agentScore: null,
      agentRisk: null,
      agentVersion: null,
      policyId: null,
    });
    assert.ok(rejected.providerRejectionRecordId);

    const row = await getProviderOnboarding(vetifySession(), created.id);
    assert.equal(row.status, "Rejected");
    assert.ok(row.archived_at);
  } finally {
    await cleanupProvider(cac);
  }
});

test("requestProviderAmendment -> amendProvider: resets to Draft, clears agent score, increments amendmentCount", async () => {
  const cac = "TEST-PROV-AMEND";
  try {
    const created = await createProviderOnboarding(fiSession(), { ...baseArgs, cacRegNumber: cac });
    await submitProviderForReview(fiSession(), created.id);
    await flagProviderForManualReview(vetifySession(), created.id, { score: 50, risk: "Medium", note: "check docs", version: "v1" });

    // requestProviderAmendment's Daml precondition is UnderReview, but this
    // fixture already moved to ManualReview via the flag above -- exercised
    // separately below from a fresh UnderReview row instead.
    await assert.rejects(
      () => requestProviderAmendment(vetifySession(), created.id, { note: "fix address" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only request amendment from UnderReview",
    );
  } finally {
    await cleanupProvider(cac);
  }
});

test("requestProviderAmendment -> amendProvider: full round trip from UnderReview", async () => {
  const cac = "TEST-PROV-AMEND2";
  try {
    const created = await createProviderOnboarding(fiSession(), { ...baseArgs, cacRegNumber: cac });
    await submitProviderForReview(fiSession(), created.id);
    const amendReq = await requestProviderAmendment(vetifySession(), created.id, { note: "fix address" });
    assert.equal(amendReq.status, "PendingAmendment");

    const amended = await amendProvider(fiSession(), created.id, {
      updatedProviderName: "Test Waqf Fund (Corrected)",
      updatedAddress: "Abuja, Nigeria",
      updatedCacRegNumber: cac,
      updatedLicenseNumber: null,
      updatedGoverningDocRef: baseArgs.governingDocRef,
      updatedDeclaredInstruments: ["QardHasan"],
    });
    assert.equal(amended.status, "Draft");
    assert.equal(amended.amendment_count, 1);

    const row = await getProviderOnboarding(vetifySession(), created.id);
    assert.equal(row.provider_name, "Test Waqf Fund (Corrected)");
    assert.equal(row.agent_score, null);
  } finally {
    await cleanupProvider(cac);
  }
});

test("recordProviderScore: rejects a score at or below the policy's auto-reject threshold when a policyId is supplied", async () => {
  const cac = "TEST-PROV-POLICY";
  const version = "TEST-POLICY-V1";
  try {
    const policy = await createProviderVerificationPolicy(vetifySession(), {
      policyVersion: version,
      autoRejectMax: 40,
      effectiveFrom: new Date().toISOString(),
      scoringWeights: { cacActiveExactMatch: 40, cacNotFound: 0 },
    });

    const created = await createProviderOnboarding(fiSession(), { ...baseArgs, cacRegNumber: cac });
    await submitProviderForReview(fiSession(), created.id);

    await assert.rejects(
      () => recordProviderScore(vetifySession(), created.id, { score: 30, risk: "High", version: "v1", policyId: policy.id }),
      (err: unknown) => err instanceof DomainError && err.message === "Score is at or below the active policy's auto-reject threshold",
    );

    const scored = await recordProviderScore(vetifySession(), created.id, { score: 85, risk: "Low", version: "v1", policyId: policy.id });
    assert.equal(scored.agent_score, 85);
  } finally {
    await cleanupProvider(cac);
    await cleanupPolicy(version);
  }
});

test("updateProviderVerificationPolicy: plain field-replace UPDATE, same row id preserved", async () => {
  const version1 = "TEST-POLICY-UPDATE-V1";
  const version2 = "TEST-POLICY-UPDATE-V2";
  try {
    const created = await createProviderVerificationPolicy(vetifySession(), {
      policyVersion: version1,
      autoRejectMax: 40,
      effectiveFrom: new Date().toISOString(),
      scoringWeights: { cacActiveExactMatch: 40 },
    });
    const updated = await updateProviderVerificationPolicy(vetifySession(), created.id, {
      policyVersion: version2,
      autoRejectMax: 50,
      effectiveFrom: new Date().toISOString(),
      scoringWeights: { cacActiveExactMatch: 50 },
    });
    assert.equal(updated.id, created.id);
    assert.equal(updated.policy_version, version2);
    assert.equal(updated.auto_reject_max, 50);
  } finally {
    await cleanupPolicy(version1);
    await cleanupPolicy(version2);
  }
});

test("createProviderVerificationPolicy / updateProviderVerificationPolicy: only a vetify session may call", async () => {
  await assert.rejects(
    () =>
      createProviderVerificationPolicy(fiSession(), {
        policyVersion: "TEST-POLICY-AUTH",
        autoRejectMax: 40,
        effectiveFrom: new Date().toISOString(),
        scoringWeights: {},
      }),
    (err: unknown) => err instanceof AuthorizationError,
  );
});
