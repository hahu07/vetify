import type { PoolClient } from "pg";
import type { SessionContext } from "@/lib/db";
import { withTransaction } from "@/lib/db";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { DomainError } from "@/lib/errors";
import type {
  BusinessKyc,
  BusinessProfile,
  DocumentRef,
  RiskLevel,
  VerificationChecks,
} from "@/lib/types";

// ─── ensure-clause translation (daml/Vetify/Onboarding.daml's `ensure`) ─────
// Daml checks this invariant every time the contract exists; here it's
// checked once, synchronously, inside the same transaction as the insert —
// see web2-migration-design.md §3 ("Structural invariants... a BEFORE
// INSERT/UPDATE trigger for cross-field logic"). Done in the domain function
// rather than a plpgsql trigger for this slice: the CAC-prefix-by-business-
// type rule and per-director digit checks are easier to read and test as
// TypeScript than as a trigger body, and this function already runs inside
// withTransaction's BEGIN/COMMIT.
function isAllDigits(text: string): boolean {
  return text.length > 0 && /^[0-9]+$/.test(text);
}

export function validateBusinessOnboarding(
  profile: BusinessProfile,
  kyc: BusinessKyc,
  documents: DocumentRef[],
): void {
  if (profile.directors.length === 0) {
    throw new DomainError(
      "CAMA 2020 s271(1) requires at least one director/proprietor",
    );
  }
  for (const d of profile.directors) {
    if (!d.name || !d.address || !d.phoneNumber || !d.email) {
      throw new DomainError("Every director must have name, address, phoneNumber, and email set");
    }
    if (d.ninNumber.length !== 11 || !isAllDigits(d.ninNumber)) {
      throw new DomainError("Director NIN must be exactly 11 digits");
    }
    if (d.bvn.length !== 11 || !isAllDigits(d.bvn)) {
      throw new DomainError("Director BVN must be exactly 11 digits");
    }
  }
  const nins = new Set(profile.directors.map((d) => d.ninNumber));
  if (nins.size !== profile.directors.length) {
    throw new DomainError("No two directors/proprietors may share a NIN");
  }
  const bvns = new Set(profile.directors.map((d) => d.bvn));
  if (bvns.size !== profile.directors.length) {
    throw new DomainError("No two directors/proprietors may share a BVN");
  }

  if (
    !profile.name ||
    !profile.address ||
    !profile.state ||
    !profile.phoneNumber ||
    !profile.email ||
    !profile.businessActivity ||
    !profile.businessSector
  ) {
    throw new DomainError("Business profile is missing a required field");
  }

  const expectedPrefix = profile.businessType === "LimitedCompany" ? "RC" : "BN";
  if (!kyc.cacRegNumber.startsWith(expectedPrefix)) {
    throw new DomainError(
      `CAC registration number must start with "${expectedPrefix}" for ${profile.businessType}`,
    );
  }
  if (kyc.cacRegNumber.length < 4) {
    throw new DomainError("CAC registration number must be at least 4 characters");
  }
  if (!isAllDigits(kyc.cacRegNumber.slice(2))) {
    throw new DomainError("CAC registration number suffix must be all digits");
  }
  if (!kyc.taxId) {
    throw new DomainError("Tax ID (TIN) is mandatory for all registered entities");
  }

  for (const doc of documents) {
    if (!doc.contentHash || !doc.docType || !doc.storageRef) {
      throw new DomainError("Every document must have a contentHash, docType, and storageRef");
    }
  }
  const docTypes = new Set(documents.map((d) => d.docType));
  if (docTypes.size !== documents.length) {
    throw new DomainError("Document types must be unique within a single submission");
  }
}

const ACTIVE_REVIEW_STATUSES = ["UnderReview", "ManualReview"];

// ─── Choice: create (business submits a Draft application) ────────────────
// Not a Daml *choice* -- BusinessOnboarding contracts are created directly --
// but the create-time `ensure` validation applies here.

async function createOnboardingImpl(
  session: SessionContext,
  args: {
    profile: BusinessProfile;
    kyc: BusinessKyc;
    documents: DocumentRef[];
    onboardingRef: string;
  },
) {
  validateBusinessOnboarding(args.profile, args.kyc, args.documents);
  return withTransaction(session, async (client: PoolClient) => {
    try {
      const { rows } = await client.query(
        `INSERT INTO business_onboarding
           (cac_reg_number, profile, kyc, documents, onboarding_ref)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, status`,
        [
          args.kyc.cacRegNumber,
          JSON.stringify(args.profile),
          JSON.stringify(args.kyc),
          JSON.stringify(args.documents),
          args.onboardingRef,
        ],
      );
      return rows[0];
    } catch (err) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        // Postgres partial unique index -- stronger than the Daml-comment's
        // "unenforced, caller-side-only convention" this replaces.
        throw new DomainError(
          `An active onboarding application already exists for CAC number ${args.kyc.cacRegNumber}`,
        );
      }
      throw err;
    }
  });
}
export const createOnboarding = withAuthorization(["business"], createOnboardingImpl);

// ─── Choice: SubmitForReview (business) ────────────────────────────────────

async function submitForReviewImpl(session: SessionContext, onboardingId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM business_onboarding WHERE id = $1 FOR UPDATE",
      [onboardingId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Onboarding application not found");

    if (row.status !== "Draft") {
      throw new DomainError("Only a Draft application can be submitted");
    }
    if (!row.onboarding_ref) {
      throw new DomainError("Onboarding reference must be set before submission");
    }
    const incorporationDate = new Date(row.profile.incorporationDate);
    if (incorporationDate.getTime() > Date.now()) {
      throw new DomainError("Incorporation date cannot be in the future");
    }

    const { rows: updated } = await client.query(
      `UPDATE business_onboarding
         SET status = 'UnderReview', submitted_at = now(), updated_at = now()
         WHERE id = $1
         RETURNING id, status, submitted_at`,
      [onboardingId],
    );
    return updated[0];
  });
}
export const submitForReview = withAuthorization(["business"], submitForReviewImpl);

// ─── Choice: FlagForManualReview (verifier) ────────────────────────────────

async function flagForManualReviewImpl(
  session: SessionContext,
  onboardingId: number,
  args: { riskScore: number; riskLevel: RiskLevel; agentVersion: string; note: string },
) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT status FROM business_onboarding WHERE id = $1 FOR UPDATE",
      [onboardingId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Onboarding application not found");
    if (row.status !== "UnderReview") {
      throw new DomainError("Can only flag from UnderReview");
    }
    if (args.riskScore < 0 || args.riskScore > 100) {
      throw new DomainError("Risk score must be 0-100");
    }

    const { rows: updated } = await client.query(
      `UPDATE business_onboarding
         SET status = 'ManualReview', agent_score = $2, agent_risk = $3,
             agent_note = $4, agent_version = $5, updated_at = now()
         WHERE id = $1
         RETURNING id, status`,
      [onboardingId, args.riskScore, args.riskLevel, args.note, args.agentVersion],
    );
    return updated[0];
  });
}
export const flagForManualReview = withAuthorization(["verifier"], flagForManualReviewImpl);

// ─── Choice: Approve (verifier, vetify dual-controller) ───────────────────
// Creates VerificationResult and archives the BusinessOnboarding it came
// from -- a genuinely new successor template, not a same-template
// recreation, so this is UPDATE (archive) + INSERT (successor), not a plain
// UPDATE. See web2-migration-design.md §3.

interface ApproveArgs {
  checks: VerificationChecks;
  riskScore: number;
  riskLevel: RiskLevel;
  autoDecided: boolean;
  reviewerParty?: string | null;
  reviewedBy?: string | null;
  verificationRef: string;
}

async function approveImpl(session: SessionContext, onboardingId: number, args: ApproveArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM business_onboarding WHERE id = $1 FOR UPDATE",
      [onboardingId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Onboarding application not found");

    if (!ACTIVE_REVIEW_STATUSES.includes(row.status)) {
      throw new DomainError("Can only approve from UnderReview or ManualReview");
    }
    if (args.riskScore < 0 || args.riskScore > 100) {
      throw new DomainError("Risk score must be 0-100");
    }
    if (!args.autoDecided && !args.reviewerParty) {
      throw new DomainError("Human decisions require a reviewer party (reviewerParty)");
    }
    const documents: unknown[] = row.documents ?? [];
    if (documents.length === 0) {
      throw new DomainError("At least one supporting document is required for approval");
    }
    if (args.autoDecided && args.riskLevel === "High") {
      throw new DomainError(
        "High-risk applications cannot be auto-approved; human review required",
      );
    }
    if (!args.checks.identityVerified) throw new DomainError("Cannot approve: identity not verified");
    if (!args.checks.cacRegistered) throw new DomainError("Cannot approve: CAC not registered");
    if (!args.checks.documentsValid) throw new DomainError("Cannot approve: documents not valid");
    if (!args.checks.dataConsistent) throw new DomainError("Cannot approve: data not consistent");
    if (!args.verificationRef) throw new DomainError("Verification reference must not be empty");

    const { rows: vr } = await client.query(
      `INSERT INTO verification_result
         (business_onboarding_id, cac_reg_number, business_name, checks, risk_score,
          risk_level, outcome, auto_decided, verification_ref, reviewer_party,
          reviewed_by, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Approved', $7, $8, $9, $10, now())
       RETURNING id`,
      [
        onboardingId,
        row.cac_reg_number,
        row.profile.name,
        JSON.stringify(args.checks),
        args.riskScore,
        args.riskLevel,
        args.autoDecided,
        args.verificationRef,
        args.reviewerParty ?? null,
        args.reviewedBy ?? null,
      ],
    );
    const verificationResultId = vr[0].id;

    await client.query(
      `UPDATE business_onboarding
         SET status = 'Approved', archived_at = now(),
             superseded_by_kind = 'verification_result', superseded_by_id = $2,
             updated_at = now()
         WHERE id = $1`,
      [onboardingId, verificationResultId],
    );

    return { verificationResultId };
  });
}
export const approve = withAuthorization(["verifier", "vetify"], approveImpl);

// ─── Choice: Reject (verifier, vetify dual-controller) ─────────────────────

interface RejectArgs {
  checks: VerificationChecks;
  riskScore: number;
  riskLevel: RiskLevel;
  autoDecided: boolean;
  reviewerParty?: string | null;
  reviewedBy?: string | null;
  verificationRef: string;
  reason: string;
}

async function rejectImpl(session: SessionContext, onboardingId: number, args: RejectArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM business_onboarding WHERE id = $1 FOR UPDATE",
      [onboardingId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Onboarding application not found");

    if (!ACTIVE_REVIEW_STATUSES.includes(row.status)) {
      throw new DomainError("Can only reject from UnderReview or ManualReview");
    }
    if (args.riskScore < 0 || args.riskScore > 100) {
      throw new DomainError("Risk score must be 0-100");
    }
    if (!args.reason) throw new DomainError("Rejection reason must not be empty");
    if (!args.verificationRef) throw new DomainError("Verification reference must not be empty");
    if (!args.autoDecided && !args.reviewerParty) {
      throw new DomainError("Human decisions require a reviewer party (reviewerParty)");
    }

    const { rows: vr } = await client.query(
      `INSERT INTO verification_result
         (business_onboarding_id, cac_reg_number, business_name, checks, risk_score,
          risk_level, outcome, auto_decided, verification_ref, reviewer_party,
          reviewed_by, note, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Rejected', $7, $8, $9, $10, $11, now())
       RETURNING id`,
      [
        onboardingId,
        row.cac_reg_number,
        row.profile.name,
        JSON.stringify(args.checks),
        args.riskScore,
        args.riskLevel,
        args.autoDecided,
        args.verificationRef,
        args.reviewerParty ?? null,
        args.reviewedBy ?? null,
        args.reason,
      ],
    );
    const verificationResultId = vr[0].id;

    await client.query(
      `UPDATE business_onboarding
         SET status = 'Rejected', archived_at = now(),
             superseded_by_kind = 'verification_result', superseded_by_id = $2,
             updated_at = now()
         WHERE id = $1`,
      [onboardingId, verificationResultId],
    );

    return { verificationResultId };
  });
}
export const reject = withAuthorization(["verifier", "vetify"], rejectImpl);

// ─── Reads ──────────────────────────────────────────────────────────────
// RLS (not an application-level filter) is what actually scopes these --
// the WHERE-less SELECT below relies entirely on the business_onboarding_select
// policy to narrow rows for a 'business' session.

export async function listOnboardings(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT id, cac_reg_number, profile, kyc, status, agent_score, agent_risk,
              agent_note, documents, submitted_at, onboarding_ref, created_at
         FROM business_onboarding
         WHERE archived_at IS NULL
         ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function getOnboarding(session: SessionContext, id: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM business_onboarding WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  });
}
