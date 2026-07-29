// Tests for lib/domain/policy.ts -- Phase 2, Fourteenth Slice (the
// VerificationPolicy/CompliancePolicy maker-checker chain). Ported from
// daml/Vetify/Onboarding.daml (VerificationPolicy, PendingVerificationPolicy)
// and daml/Vetify/Compliance.daml (CompliancePolicy, PendingCompliancePolicy).
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { AuthorizationError, DomainError } from "@/lib/errors";
import { registerPolicyApprover } from "@/lib/domain/governance";
import {
  proposeVerificationPolicy,
  endorseVerificationPolicy,
  approveVerificationPolicyChange,
  rejectVerificationPolicyChange,
  proposeCompliancePolicy,
  endorseCompliancePolicy,
  approveCompliancePolicyChange,
  rejectCompliancePolicyChange,
} from "@/lib/domain/policy";

function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
}
function riskCommitteeSession(): SessionContext {
  return { userId: 9, username: "test-riskcommittee", displayName: "Test Risk Committee", partyRole: "riskCommittee", cacRegNumber: null };
}
function fiSession(): SessionContext {
  return { userId: 5, username: "test-fi", displayName: "Test FI", partyRole: "financialInstitution", cacRegNumber: null };
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

async function cleanupVerification(policyVersion: string) {
  await fixtureClient.query(`DELETE FROM pending_verification_policy WHERE policy_version = $1`, [policyVersion]);
  await fixtureClient.query(`DELETE FROM verification_policy WHERE policy_version = $1`, [policyVersion]);
}
async function cleanupCompliance(policyVersion: string) {
  await fixtureClient.query(`DELETE FROM pending_compliance_policy WHERE policy_version = $1`, [policyVersion]);
  await fixtureClient.query(`DELETE FROM compliance_policy WHERE policy_version = $1`, [policyVersion]);
}
async function cleanupApprover(tag: string) {
  await fixtureClient.query(`DELETE FROM policy_approver WHERE authorized_by = $1`, [tag]);
}

const verificationScoringWeights = {
  identityVerified: 40, identityNameMismatch: 0, identityBvnNotFound: 0, identityNinNotFound: 0,
  cacActiveExactMatch: 30, cacActiveCloseMatch: 15, cacActiveNameMismatch: 0, cacPending: 5,
  cacInactiveOrStruckOff: 0, cacNotFound: 0, tinVerifiedMatchesCac: 20, tinVerifiedDifferentEntity: 0,
  tinNotFound: 0, tinApiError: 10,
};
const complianceScoringWeights = {
  amlBothClear: 40, amlOneReviewRequired: 0, kybActiveFullMatch: 20, kybActiveMinorDiscrepancy: 10,
  kybInactiveOrMismatch: 0, kybNotFound: 0, creditClean: 20, creditMinorResolved: 10, creditDelinquentOrDefault: 0,
};

const baseVerificationArgs = {
  maxAmendments: 5,
  slaHours: 48,
  autoApproveMin: 80,
  autoRejectMax: 50,
  requiredDocTypes: ["CAC_CERTIFICATE"],
  scoringWeights: verificationScoringWeights,
  reason: "Quarterly rubric review",
};

// ─── VerificationPolicy maker-checker ──────────────────────────────────────

test("proposeVerificationPolicy: autoApproveMin must exceed autoRejectMax", async () => {
  await assert.rejects(
    () => proposeVerificationPolicy(vetifySession(), { ...baseVerificationArgs, autoApproveMin: 40, autoRejectMax: 50, policyVersion: "TEST-VP-INVALID", proposedBy: "Alice" }),
    (err: unknown) => err instanceof DomainError && err.message === "autoApproveMin must be greater than autoRejectMax",
  );
});

test("proposeVerificationPolicy: only a vetify session may propose", async () => {
  await assert.rejects(
    () => proposeVerificationPolicy(fiSession(), { ...baseVerificationArgs, policyVersion: "TEST-VP-AUTH", proposedBy: "Alice" }),
    (err: unknown) => err instanceof AuthorizationError,
  );
});

test("endorseVerificationPolicy: only a riskCommittee session may endorse", async () => {
  const version = "TEST-VP-ENDORSE-AUTH";
  try {
    const proposed = await proposeVerificationPolicy(vetifySession(), { ...baseVerificationArgs, policyVersion: version, proposedBy: "Alice" });
    await assert.rejects(
      () => endorseVerificationPolicy(vetifySession(), proposed.id, { endorsedBy: "Bob" }),
      (err: unknown) => err instanceof AuthorizationError,
    );
  } finally {
    await cleanupVerification(version);
  }
});

test("endorseVerificationPolicy: cannot endorse twice", async () => {
  const version = "TEST-VP-ENDORSE-TWICE";
  try {
    const proposed = await proposeVerificationPolicy(vetifySession(), { ...baseVerificationArgs, policyVersion: version, proposedBy: "Alice" });
    await endorseVerificationPolicy(riskCommitteeSession(), proposed.id, { endorsedBy: "Bob" });
    await assert.rejects(
      () => endorseVerificationPolicy(riskCommitteeSession(), proposed.id, { endorsedBy: "Carol" }),
      (err: unknown) => err instanceof DomainError && err.message === "Already endorsed by the Risk Committee",
    );
  } finally {
    await cleanupVerification(version);
  }
});

test("approveVerificationPolicyChange: rejects self-approval (approver == proposer)", async () => {
  const version = "TEST-VP-SELF-APPROVE";
  try {
    const proposed = await proposeVerificationPolicy(vetifySession(), { ...baseVerificationArgs, policyVersion: version, proposedBy: "Alice" });
    await endorseVerificationPolicy(riskCommitteeSession(), proposed.id, { endorsedBy: "Bob" });
    await assert.rejects(
      () => approveVerificationPolicyChange(vetifySession(), proposed.id, { approvedBy: "Alice" }),
      (err: unknown) => err instanceof DomainError && err.message === "Approver must differ from proposer (maker-checker)",
    );
  } finally {
    await cleanupVerification(version);
  }
});

test("approveVerificationPolicyChange: rejects an approver who isn't a registered active PolicyApprover", async () => {
  const version = "TEST-VP-UNREG-APPROVER";
  try {
    const proposed = await proposeVerificationPolicy(vetifySession(), { ...baseVerificationArgs, policyVersion: version, proposedBy: "Alice" });
    await endorseVerificationPolicy(riskCommitteeSession(), proposed.id, { endorsedBy: "Bob" });
    await assert.rejects(
      () => approveVerificationPolicyChange(vetifySession(), proposed.id, { approvedBy: "Never Registered" }),
      (err: unknown) => err instanceof DomainError && err.message === "Approver Never Registered not found",
    );
  } finally {
    await cleanupVerification(version);
  }
});

test("approveVerificationPolicyChange: rejects when the Risk Committee has not yet endorsed", async () => {
  const version = "TEST-VP-NO-ENDORSE";
  const tag = "TEST-VP-NO-ENDORSE-TAG";
  try {
    const approver = await registerPolicyApprover(vetifySession(), { approverName: "Dara Approver", role: "Head of Risk", authorizedBy: tag });
    const proposed = await proposeVerificationPolicy(vetifySession(), { ...baseVerificationArgs, policyVersion: version, proposedBy: "Alice" });
    await assert.rejects(
      () => approveVerificationPolicyChange(vetifySession(), proposed.id, { approvedBy: "Dara Approver" }),
      (err: unknown) => err instanceof DomainError && err.message === "Risk Committee must endorse this change before vetify can approve it",
    );
    assert.ok(approver.id);
  } finally {
    await cleanupVerification(version);
    await cleanupApprover(tag);
  }
});

test("full lifecycle: propose -> endorse -> approve replaces the active VerificationPolicy", async () => {
  const versionA = "TEST-VP-LIFECYCLE-A";
  const versionB = "TEST-VP-LIFECYCLE-B";
  const tag = "TEST-VP-LIFECYCLE-TAG";
  try {
    await registerPolicyApprover(vetifySession(), { approverName: "Dara Approver 2", role: "Head of Risk", authorizedBy: tag });

    const proposedA = await proposeVerificationPolicy(vetifySession(), { ...baseVerificationArgs, policyVersion: versionA, proposedBy: "Alice" });
    await endorseVerificationPolicy(riskCommitteeSession(), proposedA.id, { endorsedBy: "Bob" });
    const approvedA = await approveVerificationPolicyChange(vetifySession(), proposedA.id, { approvedBy: "Dara Approver 2" });
    assert.ok(approvedA.verificationPolicyId);

    const { rows: activeA } = await fixtureClient.query(
      "SELECT archived_at FROM verification_policy WHERE id = $1",
      [approvedA.verificationPolicyId],
    );
    assert.equal(activeA[0].archived_at, null);

    // A second policy change should archive the first VerificationPolicy row.
    const proposedB = await proposeVerificationPolicy(vetifySession(), { ...baseVerificationArgs, policyVersion: versionB, proposedBy: "Alice" });
    await endorseVerificationPolicy(riskCommitteeSession(), proposedB.id, { endorsedBy: "Bob" });
    const approvedB = await approveVerificationPolicyChange(vetifySession(), proposedB.id, { approvedBy: "Dara Approver 2" });

    const { rows: afterB } = await fixtureClient.query(
      "SELECT archived_at FROM verification_policy WHERE id = $1",
      [approvedA.verificationPolicyId],
    );
    assert.ok(afterB[0].archived_at, "the previously-active policy should now be archived");

    const { rows: nowActive } = await fixtureClient.query(
      "SELECT archived_at FROM verification_policy WHERE id = $1",
      [approvedB.verificationPolicyId],
    );
    assert.equal(nowActive[0].archived_at, null);

    // The pending row itself is archived and points at its successor.
    const { rows: pendingRow } = await fixtureClient.query(
      "SELECT archived_at, superseded_by_kind, superseded_by_id FROM pending_verification_policy WHERE id = $1",
      [proposedB.id],
    );
    assert.ok(pendingRow[0].archived_at);
    assert.equal(pendingRow[0].superseded_by_kind, "verification_policy");
    assert.equal(Number(pendingRow[0].superseded_by_id), Number(approvedB.verificationPolicyId));
  } finally {
    await cleanupVerification(versionA);
    await cleanupVerification(versionB);
    await cleanupApprover(tag);
  }
});

test("rejectVerificationPolicyChange: self-rejection is fine (unlike self-approval)", async () => {
  const version = "TEST-VP-SELF-REJECT";
  try {
    const proposed = await proposeVerificationPolicy(vetifySession(), { ...baseVerificationArgs, policyVersion: version, proposedBy: "Alice" });
    const rejected = await rejectVerificationPolicyChange(vetifySession(), proposed.id, { rejectedBy: "Alice", rejectionReason: "Changed my mind" });
    assert.equal(rejected.id, proposed.id);

    const { rows } = await fixtureClient.query("SELECT archived_at FROM pending_verification_policy WHERE id = $1", [proposed.id]);
    assert.ok(rows[0].archived_at);
  } finally {
    await cleanupVerification(version);
  }
});

// ─── CompliancePolicy maker-checker (identically-shaped) ───────────────────

const baseComplianceArgs = {
  autoApproveMin: 80,
  autoRejectMax: 50,
  escalationSlaHours: 24,
  shariahPolicyVersion: "AAOIFI-2023-Std8",
  effectiveFrom: new Date().toISOString(),
  scoringWeights: complianceScoringWeights,
  reason: "Quarterly rubric review",
};

test("proposeCompliancePolicy: effectiveFrom must be before effectiveTo when both are given", async () => {
  const now = new Date();
  const before = new Date(now.getTime() - 3600_000).toISOString();
  await assert.rejects(
    () => proposeCompliancePolicy(vetifySession(), {
      ...baseComplianceArgs, policyVersion: "TEST-CP-INVALID-DATES", proposedBy: "Alice",
      effectiveFrom: now.toISOString(), effectiveTo: before,
    }),
    (err: unknown) => err instanceof DomainError && err.message === "effectiveFrom must be before effectiveTo",
  );
});

test("full lifecycle: propose -> endorse -> approve replaces the active CompliancePolicy", async () => {
  const versionA = "TEST-CP-LIFECYCLE-A";
  const versionB = "TEST-CP-LIFECYCLE-B";
  const tag = "TEST-CP-LIFECYCLE-TAG";
  try {
    await registerPolicyApprover(vetifySession(), { approverName: "Dara Approver 3", role: "Head of Risk", authorizedBy: tag });

    const proposedA = await proposeCompliancePolicy(vetifySession(), { ...baseComplianceArgs, policyVersion: versionA, proposedBy: "Alice" });
    await endorseCompliancePolicy(riskCommitteeSession(), proposedA.id, { endorsedBy: "Bob" });
    const approvedA = await approveCompliancePolicyChange(vetifySession(), proposedA.id, { approvedBy: "Dara Approver 3" });
    assert.ok(approvedA.compliancePolicyId);

    const proposedB = await proposeCompliancePolicy(vetifySession(), { ...baseComplianceArgs, policyVersion: versionB, proposedBy: "Alice" });
    await endorseCompliancePolicy(riskCommitteeSession(), proposedB.id, { endorsedBy: "Bob" });
    const approvedB = await approveCompliancePolicyChange(vetifySession(), proposedB.id, { approvedBy: "Dara Approver 3" });

    const { rows: afterB } = await fixtureClient.query(
      "SELECT archived_at FROM compliance_policy WHERE id = $1",
      [approvedA.compliancePolicyId],
    );
    assert.ok(afterB[0].archived_at, "the previously-active policy should now be archived");

    const { rows: nowActive } = await fixtureClient.query(
      "SELECT archived_at FROM compliance_policy WHERE id = $1",
      [approvedB.compliancePolicyId],
    );
    assert.equal(nowActive[0].archived_at, null);
  } finally {
    await cleanupCompliance(versionA);
    await cleanupCompliance(versionB);
    await cleanupApprover(tag);
  }
});

test("rejectCompliancePolicyChange: rejectionReason must not be empty", async () => {
  const version = "TEST-CP-EMPTY-REASON";
  try {
    const proposed = await proposeCompliancePolicy(vetifySession(), { ...baseComplianceArgs, policyVersion: version, proposedBy: "Alice" });
    await assert.rejects(
      () => rejectCompliancePolicyChange(vetifySession(), proposed.id, { rejectedBy: "Alice", rejectionReason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "rejectionReason must not be empty",
    );
  } finally {
    await cleanupCompliance(version);
  }
});
