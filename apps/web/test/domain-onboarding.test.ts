// Unit/integration tests for lib/domain/onboarding.ts's ported assertMsg
// guards (addendum C's point 1: "every assertMsg has a unit-tested
// TypeScript guard with identical error text"). validateBusinessOnboarding
// is a pure function -- tested directly, no DB. The choice functions
// (createOnboarding/submitForReview/approve/reject/flagForManualReview) go
// through withTransaction's real BEGIN/COMMIT, so each test uses a unique
// CAC number and cleans up its own rows in `after` rather than relying on
// rollback (unlike test/rls.test.ts, which never commits).
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { AuthorizationError, DomainError } from "@/lib/errors";
import {
  validateBusinessOnboarding,
  createOnboarding,
  submitForReview,
  approve,
  reject,
  flagForManualReview,
  requestAmendment,
  amend,
  escalateOverdue,
} from "@/lib/domain/onboarding";
import type { BusinessKyc, BusinessProfile, DocumentRef } from "@/lib/types";

function validProfile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  return {
    name: "Test Business",
    address: "1 Test Street",
    state: "Lagos",
    phoneNumber: "+2348012345678",
    email: "test@example.com",
    businessType: "LimitedCompany",
    incorporationDate: "2020-01-01",
    directors: [
      {
        name: "Test Director",
        address: "1 Test Street",
        phoneNumber: "+2348012345678",
        ninNumber: "12345678901",
        bvn: "22345678901",
        email: "director@example.com",
      },
    ],
    businessActivity: "Retail sale of electronics",
    businessSector: "Retail Trade",
    ...overrides,
  };
}

function validKyc(overrides: Partial<BusinessKyc> = {}): BusinessKyc {
  return { cacRegNumber: "RC1000001", taxId: "TIN-1000001", ...overrides };
}

const validDocuments: DocumentRef[] = [
  { docType: "CAC_CERTIFICATE", contentHash: "a".repeat(64), storageRef: "local://cert.pdf" },
];

// ─── validateBusinessOnboarding (pure, no DB) ──────────────────────────────

test("validateBusinessOnboarding: rejects zero directors", () => {
  assert.throws(
    () => validateBusinessOnboarding(validProfile({ directors: [] }), validKyc(), validDocuments),
    /CAMA 2020 s271\(1\) requires at least one director\/proprietor/,
  );
});

test("validateBusinessOnboarding: rejects a director missing a required field", () => {
  const profile = validProfile({ directors: [{ ...validProfile().directors[0], name: "" }] });
  assert.throws(
    () => validateBusinessOnboarding(profile, validKyc(), validDocuments),
    /Every director must have name, address, phoneNumber, and email set/,
  );
});

test("validateBusinessOnboarding: rejects a NIN that isn't exactly 11 digits", () => {
  const profile = validProfile({ directors: [{ ...validProfile().directors[0], ninNumber: "123" }] });
  assert.throws(
    () => validateBusinessOnboarding(profile, validKyc(), validDocuments),
    /Director NIN must be exactly 11 digits/,
  );
});

test("validateBusinessOnboarding: rejects a non-digit NIN", () => {
  const profile = validProfile({ directors: [{ ...validProfile().directors[0], ninNumber: "1234567890a" }] });
  assert.throws(
    () => validateBusinessOnboarding(profile, validKyc(), validDocuments),
    /Director NIN must be exactly 11 digits/,
  );
});

test("validateBusinessOnboarding: rejects a BVN that isn't exactly 11 digits", () => {
  const profile = validProfile({ directors: [{ ...validProfile().directors[0], bvn: "123" }] });
  assert.throws(
    () => validateBusinessOnboarding(profile, validKyc(), validDocuments),
    /Director BVN must be exactly 11 digits/,
  );
});

test("validateBusinessOnboarding: rejects two directors sharing a NIN", () => {
  const d = validProfile().directors[0];
  const profile = validProfile({ directors: [d, { ...d, bvn: "99999999999" }] });
  assert.throws(
    () => validateBusinessOnboarding(profile, validKyc(), validDocuments),
    /No two directors\/proprietors may share a NIN/,
  );
});

test("validateBusinessOnboarding: rejects two directors sharing a BVN", () => {
  const d = validProfile().directors[0];
  const profile = validProfile({ directors: [d, { ...d, ninNumber: "99999999999" }] });
  assert.throws(
    () => validateBusinessOnboarding(profile, validKyc(), validDocuments),
    /No two directors\/proprietors may share a BVN/,
  );
});

test("validateBusinessOnboarding: rejects a missing business profile field", () => {
  assert.throws(
    () => validateBusinessOnboarding(validProfile({ name: "" }), validKyc(), validDocuments),
    /Business profile is missing a required field/,
  );
});

test("validateBusinessOnboarding: LimitedCompany CAC number must start with RC", () => {
  assert.throws(
    () =>
      validateBusinessOnboarding(
        validProfile({ businessType: "LimitedCompany" }),
        validKyc({ cacRegNumber: "BN1234567" }),
        validDocuments,
      ),
    /CAC registration number must start with "RC" for LimitedCompany/,
  );
});

test("validateBusinessOnboarding: SoleProprietorship CAC number must start with BN", () => {
  assert.throws(
    () =>
      validateBusinessOnboarding(
        validProfile({ businessType: "SoleProprietorship" }),
        validKyc({ cacRegNumber: "RC1234567" }),
        validDocuments,
      ),
    /CAC registration number must start with "BN" for SoleProprietorship/,
  );
});

test("validateBusinessOnboarding: CAC number must be at least 4 characters", () => {
  assert.throws(
    () => validateBusinessOnboarding(validProfile(), validKyc({ cacRegNumber: "RC1" }), validDocuments),
    /CAC registration number must be at least 4 characters/,
  );
});

test("validateBusinessOnboarding: CAC number suffix must be all digits", () => {
  assert.throws(
    () => validateBusinessOnboarding(validProfile(), validKyc({ cacRegNumber: "RCABCD" }), validDocuments),
    /CAC registration number suffix must be all digits/,
  );
});

test("validateBusinessOnboarding: taxId is mandatory", () => {
  assert.throws(
    () => validateBusinessOnboarding(validProfile(), validKyc({ taxId: "" }), validDocuments),
    /Tax ID \(TIN\) is mandatory for all registered entities/,
  );
});

test("validateBusinessOnboarding: rejects a document missing a required field", () => {
  const documents: DocumentRef[] = [{ docType: "CAC_CERTIFICATE", contentHash: "", storageRef: "local://cert.pdf" }];
  assert.throws(
    () => validateBusinessOnboarding(validProfile(), validKyc(), documents),
    /Every document must have a contentHash, docType, and storageRef/,
  );
});

test("validateBusinessOnboarding: rejects duplicate document types", () => {
  const documents: DocumentRef[] = [
    { docType: "CAC_CERTIFICATE", contentHash: "a".repeat(64), storageRef: "local://a.pdf" },
    { docType: "CAC_CERTIFICATE", contentHash: "b".repeat(64), storageRef: "local://b.pdf" },
  ];
  assert.throws(
    () => validateBusinessOnboarding(validProfile(), validKyc(), documents),
    /Document types must be unique within a single submission/,
  );
});

test("validateBusinessOnboarding: accepts a fully valid application", () => {
  assert.doesNotThrow(() => validateBusinessOnboarding(validProfile(), validKyc(), validDocuments));
});

// ─── Choice functions (real DB, cleaned up per test) ───────────────────────

function businessSession(cacRegNumber: string): SessionContext {
  return { userId: 1, username: "test-business", displayName: "Test Business", partyRole: "business", cacRegNumber };
}
function verifierSession(): SessionContext {
  return { userId: 2, username: "test-verifier", displayName: "Test Verifier", partyRole: "verifier", cacRegNumber: null };
}
function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
}

// vetify_web_app (the app pool above) deliberately has no DELETE grant --
// this schema never physically deletes rows in production (see
// migrations/002_app_role.sql). Test cleanup is the one legitimate reason
// to bypass that here, so it uses its own connection as the migration-
// owning role instead of trying to route deletes through the app pool.
const cleanupClient = new Client({
  host: process.env.WEB_POSTGRES_HOST ?? "localhost",
  port: Number(process.env.WEB_POSTGRES_PORT ?? 5434),
  user: process.env.WEB_POSTGRES_USER ?? "vetify_web",
  password: process.env.WEB_POSTGRES_PASSWORD ?? "vetify_web",
  database: process.env.WEB_POSTGRES_DATABASE ?? "vetify_web",
});

async function cleanup(cacRegNumber: string) {
  await cleanupClient.query(`DELETE FROM verification_result WHERE cac_reg_number = $1`, [cacRegNumber]);
  await cleanupClient.query(`DELETE FROM business_onboarding WHERE cac_reg_number = $1`, [cacRegNumber]);
}

before(async () => {
  await cleanupClient.connect();
});

after(async () => {
  await cleanupClient.end();
  await pool.end();
});

test("createOnboarding: withAuthorization rejects a non-business session", async () => {
  await assert.rejects(
    () =>
      createOnboarding(verifierSession(), {
        profile: validProfile(),
        kyc: validKyc({ cacRegNumber: "RC2000001" }),
        documents: validDocuments,
        onboardingRef: "ONB-TEST-1",
      }),
    AuthorizationError,
  );
});

test("createOnboarding + submitForReview: full Draft -> UnderReview happy path", async () => {
  const cac = "RC2000002";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(),
      kyc: validKyc({ cacRegNumber: cac }),
      documents: validDocuments,
      onboardingRef: "ONB-TEST-2",
    });
    assert.equal(created.status, "Draft");

    const submitted = await submitForReview(businessSession(cac), created.id);
    assert.equal(submitted.status, "UnderReview");
  } finally {
    await cleanup(cac);
  }
});

test("createOnboarding: duplicate active CAC number is rejected (partial unique index)", async () => {
  const cac = "RC2000003";
  try {
    await createOnboarding(businessSession(cac), {
      profile: validProfile(),
      kyc: validKyc({ cacRegNumber: cac }),
      documents: validDocuments,
      onboardingRef: "ONB-TEST-3A",
    });
    await assert.rejects(
      () =>
        createOnboarding(businessSession(cac), {
          profile: validProfile(),
          kyc: validKyc({ cacRegNumber: cac }),
          documents: validDocuments,
          onboardingRef: "ONB-TEST-3B",
        }),
      (err: unknown) => err instanceof DomainError && /already exists for CAC number/.test(err.message),
    );
  } finally {
    await cleanup(cac);
  }
});

test("submitForReview: only a Draft application can be submitted", async () => {
  const cac = "RC2000004";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(),
      kyc: validKyc({ cacRegNumber: cac }),
      documents: validDocuments,
      onboardingRef: "ONB-TEST-4",
    });
    await submitForReview(businessSession(cac), created.id);
    await assert.rejects(
      () => submitForReview(businessSession(cac), created.id),
      (err: unknown) => err instanceof DomainError && err.message === "Only a Draft application can be submitted",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approve: requires at least one document", async () => {
  const cac = "RC2000005";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(),
      kyc: validKyc({ cacRegNumber: cac }),
      documents: [],
      onboardingRef: "ONB-TEST-5",
    });
    await submitForReview(businessSession(cac), created.id);
    await assert.rejects(
      () =>
        approve(verifierSession(), created.id, {
          checks: { identityVerified: true, cacRegistered: true, documentsValid: true, dataConsistent: true },
          riskScore: 90,
          riskLevel: "Low",
          autoDecided: false,
          reviewerParty: "verifier",
          verificationRef: "VER-TEST-5",
        }),
      (err: unknown) =>
        err instanceof DomainError && err.message === "At least one supporting document is required for approval",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approve: requires all four checks to pass", async () => {
  const cac = "RC2000006";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(),
      kyc: validKyc({ cacRegNumber: cac }),
      documents: validDocuments,
      onboardingRef: "ONB-TEST-6",
    });
    await submitForReview(businessSession(cac), created.id);
    await assert.rejects(
      () =>
        approve(verifierSession(), created.id, {
          checks: { identityVerified: false, cacRegistered: true, documentsValid: true, dataConsistent: true },
          riskScore: 90,
          riskLevel: "Low",
          autoDecided: false,
          reviewerParty: "verifier",
          verificationRef: "VER-TEST-6",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Cannot approve: identity not verified",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approve: full UnderReview -> Approved happy path archives the source row", async () => {
  const cac = "RC2000007";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(),
      kyc: validKyc({ cacRegNumber: cac }),
      documents: validDocuments,
      onboardingRef: "ONB-TEST-7",
    });
    await submitForReview(businessSession(cac), created.id);
    const result = await approve(verifierSession(), created.id, {
      checks: { identityVerified: true, cacRegistered: true, documentsValid: true, dataConsistent: true },
      riskScore: 90,
      riskLevel: "Low",
      autoDecided: false,
      reviewerParty: "verifier",
      verificationRef: "VER-TEST-7",
    });
    assert.ok(result.verificationResultId);

    // cleanupClient (superuser), not the RLS-protected app pool -- a bare
    // pool.query() here would run with no session vars set, and correctly
    // see zero rows under business_onboarding_select (found while writing
    // this test).
    const { rows } = await cleanupClient.query("SELECT status, archived_at FROM business_onboarding WHERE id = $1", [created.id]);
    assert.equal(rows[0].status, "Approved");
    assert.ok(rows[0].archived_at, "source row must be archived after Approve");
  } finally {
    await cleanup(cac);
  }
});

test("reject: rejection reason must not be empty", async () => {
  const cac = "RC2000008";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(),
      kyc: validKyc({ cacRegNumber: cac }),
      documents: validDocuments,
      onboardingRef: "ONB-TEST-8",
    });
    await submitForReview(businessSession(cac), created.id);
    await assert.rejects(
      () =>
        reject(verifierSession(), created.id, {
          checks: { identityVerified: false, cacRegistered: false, documentsValid: false, dataConsistent: false },
          riskScore: 20,
          riskLevel: "High",
          autoDecided: false,
          reviewerParty: "verifier",
          verificationRef: "VER-TEST-8",
          reason: "",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Rejection reason must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("flagForManualReview: can only flag from UnderReview", async () => {
  const cac = "RC2000009";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(),
      kyc: validKyc({ cacRegNumber: cac }),
      documents: validDocuments,
      onboardingRef: "ONB-TEST-9",
    });
    // Still Draft -- has not been submitted yet.
    await assert.rejects(
      () =>
        flagForManualReview(verifierSession(), created.id, {
          riskScore: 60,
          riskLevel: "Medium",
          agentVersion: "test-v1",
          note: "test flag",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only flag from UnderReview",
    );
  } finally {
    await cleanup(cac);
  }
});

test("flagForManualReview: withAuthorization rejects a non-verifier session", async () => {
  await assert.rejects(
    () =>
      flagForManualReview(vetifySession(), 1, {
        riskScore: 60,
        riskLevel: "Medium",
        agentVersion: "test-v1",
        note: "test",
      }),
    AuthorizationError,
  );
});

// ─── RequestAmendment / Amend / EscalateOverdue (Phase 2, Eighteenth Slice) ─

test("requestAmendment: only a vetify session may call", async () => {
  await assert.rejects(
    () => requestAmendment(businessSession("RC2000900"), 1, { note: "fix address" }),
    AuthorizationError,
  );
});

test("requestAmendment: can only request from UnderReview or ManualReview", async () => {
  const cac = "RC2000901";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(), kyc: validKyc({ cacRegNumber: cac }), documents: validDocuments, onboardingRef: "ONB-TEST-901",
    });
    // Still Draft -- submitForReview was never called.
    await assert.rejects(
      () => requestAmendment(vetifySession(), created.id, { note: "fix address" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only request amendment from UnderReview or ManualReview",
    );
  } finally {
    await cleanup(cac);
  }
});

test("amend: only a business session may call", async () => {
  await assert.rejects(
    () => amend(vetifySession(), 1, { updatedProfile: validProfile(), updatedKyc: validKyc(), updatedDocuments: validDocuments }),
    AuthorizationError,
  );
});

test("amend: can only amend a PendingAmendment application", async () => {
  const cac = "RC2000902";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(), kyc: validKyc({ cacRegNumber: cac }), documents: validDocuments, onboardingRef: "ONB-TEST-902",
    });
    // Still Draft.
    await assert.rejects(
      () => amend(businessSession(cac), created.id, { updatedProfile: validProfile(), updatedKyc: validKyc({ cacRegNumber: cac }), updatedDocuments: validDocuments }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only amend a PendingAmendment application",
    );
  } finally {
    await cleanup(cac);
  }
});

test("amend: CAC registration number cannot change during amendment", async () => {
  const cac = "RC2000903";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(), kyc: validKyc({ cacRegNumber: cac }), documents: validDocuments, onboardingRef: "ONB-TEST-903",
    });
    await submitForReview(businessSession(cac), created.id);
    await requestAmendment(vetifySession(), created.id, { note: "fix address" });

    await assert.rejects(
      () => amend(businessSession(cac), created.id, {
        updatedProfile: validProfile(), updatedKyc: validKyc({ cacRegNumber: "RC9999999" }), updatedDocuments: validDocuments,
      }),
      (err: unknown) => err instanceof DomainError && err.message === "CAC registration number cannot change during amendment",
    );
  } finally {
    await cleanup(cac);
  }
});

test("full lifecycle: requestAmendment -> amend resets to Draft, clears agent score, appends document_history, increments amendmentCount", async () => {
  const cac = "RC2000904";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(), kyc: validKyc({ cacRegNumber: cac }), documents: validDocuments, onboardingRef: "ONB-TEST-904",
    });
    await submitForReview(businessSession(cac), created.id);
    await flagForManualReview(verifierSession(), created.id, { riskScore: 55, riskLevel: "Medium", agentVersion: "v1", note: "needs a look" });
    const amendReq = await requestAmendment(vetifySession(), created.id, { note: "Address looks incomplete" });
    assert.equal(amendReq.status, "PendingAmendment");

    const newDocuments: DocumentRef[] = [
      { docType: "CAC_CERTIFICATE", contentHash: "c".repeat(64), storageRef: "local://updated-cert.pdf" },
    ];
    const amended = await amend(businessSession(cac), created.id, {
      updatedProfile: validProfile({ address: "2 New Street" }),
      updatedKyc: validKyc({ cacRegNumber: cac }),
      updatedDocuments: newDocuments,
    });
    assert.equal(amended.status, "Draft");
    assert.equal(amended.amendment_count, 1);

    const { rows } = await cleanupClient.query("SELECT * FROM business_onboarding WHERE id = $1", [created.id]);
    assert.equal(rows[0].profile.address, "2 New Street");
    assert.equal(rows[0].agent_score, null);
    assert.equal(rows[0].document_history.length, 1);
    assert.equal(rows[0].document_history[0][0].docType, "CAC_CERTIFICATE");
    assert.equal(rows[0].document_history[0][0].storageRef, "local://cert.pdf");
  } finally {
    await cleanup(cac);
  }
});

test("amend: enforces the amendment limit (default 5, or policyMaxAmendments when supplied)", async () => {
  const cac = "RC2000905";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(), kyc: validKyc({ cacRegNumber: cac }), documents: validDocuments, onboardingRef: "ONB-TEST-905",
    });
    await submitForReview(businessSession(cac), created.id);
    await requestAmendment(vetifySession(), created.id, { note: "test" });

    await assert.rejects(
      () => amend(businessSession(cac), created.id, {
        updatedProfile: validProfile(), updatedKyc: validKyc({ cacRegNumber: cac }), updatedDocuments: validDocuments,
        policyMaxAmendments: 0,
      }),
      (err: unknown) => err instanceof DomainError && err.message === "Amendment limit reached; maximum 0 amendments permitted",
    );
  } finally {
    await cleanup(cac);
  }
});

test("escalateOverdue: SLA hours must be positive", async () => {
  await assert.rejects(
    () => escalateOverdue(vetifySession(), 1, { slaHours: 0 }),
    (err: unknown) => err instanceof DomainError && err.message === "SLA hours must be positive",
  );
});

test("escalateOverdue: can only escalate an application under review", async () => {
  const cac = "RC2000906";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(), kyc: validKyc({ cacRegNumber: cac }), documents: validDocuments, onboardingRef: "ONB-TEST-906",
    });
    // Still Draft -- submitForReview was never called.
    await assert.rejects(
      () => escalateOverdue(vetifySession(), created.id, { slaHours: 48 }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only escalate an application under review",
    );
  } finally {
    await cleanup(cac);
  }
});

test("escalateOverdue: rejects while the SLA window has not yet expired", async () => {
  const cac = "RC2000907";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(), kyc: validKyc({ cacRegNumber: cac }), documents: validDocuments, onboardingRef: "ONB-TEST-907",
    });
    await submitForReview(businessSession(cac), created.id);
    await assert.rejects(
      () => escalateOverdue(vetifySession(), created.id, { slaHours: 48 }),
      (err: unknown) => err instanceof DomainError && err.message === "SLA window has not yet expired",
    );
  } finally {
    await cleanup(cac);
  }
});

test("escalateOverdue: succeeds once the SLA window has expired, moving status to ManualReview", async () => {
  const cac = "RC2000908";
  try {
    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(), kyc: validKyc({ cacRegNumber: cac }), documents: validDocuments, onboardingRef: "ONB-TEST-908",
    });
    await submitForReview(businessSession(cac), created.id);
    // Backdate submitted_at to simulate real elapsed time -- the superuser
    // cleanup client is the only connection with UPDATE rights outside the
    // real domain-function transaction path.
    await cleanupClient.query(
      "UPDATE business_onboarding SET submitted_at = now() - interval '3 hours' WHERE id = $1",
      [created.id],
    );
    const escalated = await escalateOverdue(vetifySession(), created.id, { slaHours: 1 });
    assert.equal(escalated.status, "ManualReview");
  } finally {
    await cleanup(cac);
  }
});

test("escalateOverdue: an active VerificationPolicy's slaHours overrides the caller-supplied fallback", async () => {
  const cac = "RC2000909";
  try {
    const policy = await cleanupClient.query(
      `INSERT INTO verification_policy (max_amendments, sla_hours, auto_approve_min, auto_reject_max, policy_version, scoring_weights)
       VALUES (5, 1, 80, 50, 'TEST-ESCALATE-POLICY', '{}') RETURNING id`,
    );
    const policyId = policy.rows[0].id;

    const created = await createOnboarding(businessSession(cac), {
      profile: validProfile(), kyc: validKyc({ cacRegNumber: cac }), documents: validDocuments, onboardingRef: "ONB-TEST-909",
    });
    await submitForReview(businessSession(cac), created.id);
    await cleanupClient.query(
      "UPDATE business_onboarding SET submitted_at = now() - interval '2 hours' WHERE id = $1",
      [created.id],
    );
    // A caller-supplied slaHours of 48 would normally reject (window not
    // expired), but the active policy's sla_hours = 1 takes precedence.
    const escalated = await escalateOverdue(vetifySession(), created.id, { slaHours: 48, policyId });
    assert.equal(escalated.status, "ManualReview");

    await cleanupClient.query("DELETE FROM verification_policy WHERE id = $1", [policyId]);
  } finally {
    await cleanup(cac);
  }
});
