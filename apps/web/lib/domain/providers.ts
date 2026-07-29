import type { SessionContext } from "@/lib/db";
import { withTransaction } from "@/lib/db";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { DomainError } from "@/lib/errors";

// Phase 2, Eleventh Slice (web2-migration-design.md): Stage 0, ported from
// daml/Vetify/FinancingProvider.daml. See migrations/016's header for scope
// notes (no real off-ledger scorer exists yet, so RecordProviderScore/
// RejectProvider's policyId consistency check has no real caller today; not
// wired into financing.ts's approveFundingImpl, matching that file's
// already-existing deferred scope).

const REVIEWABLE_STATUSES = ["UnderReview", "ManualReview"];

interface DocumentRef {
  docType: string;
  contentHash: string;
  storageRef: string;
  mimeType?: string | null;
  malwareScanStatus?: string | null;
  fileSize?: number | null;
  checksumAlgorithm?: string | null;
}

// ─── Create (FI self-registers, Draft status) ──────────────────────────────
// Not a Daml *choice* -- FinancingProviderOnboarding contracts are created
// directly, same as BusinessOnboarding in Phase 1 -- but the create-time
// `ensure` validation applies here.

interface CreateProviderArgs {
  providerName: string;
  address: string;
  cacRegNumber: string;
  providerType: string;
  regulatoryBody?: string | null;
  licenseNumber?: string | null;
  governingDocRef: DocumentRef;
  declaredInstruments: string[];
}

async function createProviderOnboardingImpl(session: SessionContext, args: CreateProviderArgs) {
  if (!args.providerName) throw new DomainError("providerName must not be empty");
  if (!args.cacRegNumber) throw new DomainError("cacRegNumber must not be empty");
  if (args.declaredInstruments.length === 0) {
    throw new DomainError("Must declare at least one financing instrument");
  }
  return withTransaction(session, async (client) => {
    try {
      const { rows } = await client.query(
        `INSERT INTO financing_provider_onboarding
           (provider_name, address, cac_reg_number, provider_type, regulatory_body,
            license_number, governing_doc_ref, declared_instruments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, status`,
        [
          args.providerName,
          args.address,
          args.cacRegNumber,
          args.providerType,
          args.regulatoryBody ?? null,
          args.licenseNumber ?? null,
          JSON.stringify(args.governingDocRef),
          JSON.stringify(args.declaredInstruments),
        ],
      );
      return rows[0];
    } catch (err) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        throw new DomainError(
          `An active provider registration already exists for CAC number ${args.cacRegNumber}`,
        );
      }
      throw err;
    }
  });
}
export const createProviderOnboarding = withAuthorization(["financialInstitution"], createProviderOnboardingImpl);

// ─── Choice: SubmitProviderForReview (financialInstitution) ───────────────

async function submitProviderForReviewImpl(session: SessionContext, id: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT status FROM financing_provider_onboarding WHERE id = $1 FOR UPDATE",
      [id],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Provider registration not found");
    if (row.status !== "Draft") throw new DomainError("Can only submit from Draft");

    const { rows: updated } = await client.query(
      `UPDATE financing_provider_onboarding
         SET status = 'UnderReview', submitted_at = now(), updated_at = now()
         WHERE id = $1
         RETURNING id, status, submitted_at`,
      [id],
    );
    return updated[0];
  });
}
export const submitProviderForReview = withAuthorization(["financialInstitution"], submitProviderForReviewImpl);

// ─── Choice: RecordProviderScore (vetify) ──────────────────────────────────
// Records the scorer's outcome without a status transition -- ApproveProvider's
// approvedInstruments selection is always a manual vetify decision (see the
// Daml template's own doc comment), so even a Low-risk score just leaves the
// record at UnderReview for vetify to review with a computed score visible.

interface RecordScoreArgs {
  score: number;
  risk: string;
  note?: string | null;
  version: string;
  policyId?: number | null;
}

async function recordProviderScoreImpl(session: SessionContext, id: number, args: RecordScoreArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT status FROM financing_provider_onboarding WHERE id = $1 FOR UPDATE",
      [id],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Provider registration not found");
    if (row.status !== "UnderReview") throw new DomainError("Can only record a score while UnderReview");

    if (args.policyId != null) {
      const { rows: policyRows } = await client.query(
        "SELECT auto_reject_max FROM provider_verification_policy WHERE id = $1",
        [args.policyId],
      );
      const policy = policyRows[0];
      if (!policy) throw new DomainError("Provider verification policy not found");
      if (!(args.score > policy.auto_reject_max)) {
        throw new DomainError("Score is at or below the active policy's auto-reject threshold");
      }
    }

    const { rows: updated } = await client.query(
      `UPDATE financing_provider_onboarding
         SET agent_score = $2, agent_risk = $3, agent_note = $4, agent_version = $5, updated_at = now()
         WHERE id = $1
         RETURNING id, status, agent_score, agent_risk`,
      [id, args.score, args.risk, args.note ?? null, args.version],
    );
    return updated[0];
  });
}
export const recordProviderScore = withAuthorization(["vetify"], recordProviderScoreImpl);

// ─── Choice: FlagProviderForManualReview (vetify) ──────────────────────────

interface FlagProviderArgs {
  score: number;
  risk: string;
  note: string;
  version: string;
}

async function flagProviderForManualReviewImpl(session: SessionContext, id: number, args: FlagProviderArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT status FROM financing_provider_onboarding WHERE id = $1 FOR UPDATE",
      [id],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Provider registration not found");
    if (row.status !== "UnderReview") throw new DomainError("Can only flag from UnderReview");

    const { rows: updated } = await client.query(
      `UPDATE financing_provider_onboarding
         SET status = 'ManualReview', agent_score = $2, agent_risk = $3, agent_note = $4, agent_version = $5, updated_at = now()
         WHERE id = $1
         RETURNING id, status`,
      [id, args.score, args.risk, args.note, args.version],
    );
    return updated[0];
  });
}
export const flagProviderForManualReview = withAuthorization(["vetify"], flagProviderForManualReviewImpl);

// ─── Choice: RequestProviderAmendment (vetify) ─────────────────────────────

async function requestProviderAmendmentImpl(session: SessionContext, id: number, _args: { note: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT status FROM financing_provider_onboarding WHERE id = $1 FOR UPDATE",
      [id],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Provider registration not found");
    if (row.status !== "UnderReview") throw new DomainError("Can only request amendment from UnderReview");

    const { rows: updated } = await client.query(
      `UPDATE financing_provider_onboarding SET status = 'PendingAmendment', updated_at = now()
         WHERE id = $1 RETURNING id, status`,
      [id],
    );
    return updated[0];
  });
}
export const requestProviderAmendment = withAuthorization(["vetify"], requestProviderAmendmentImpl);

// ─── Choice: AmendProvider (financialInstitution) ──────────────────────────

interface AmendProviderArgs {
  updatedProviderName: string;
  updatedAddress: string;
  updatedCacRegNumber: string;
  updatedLicenseNumber?: string | null;
  updatedGoverningDocRef: DocumentRef;
  updatedDeclaredInstruments: string[];
}

async function amendProviderImpl(session: SessionContext, id: number, args: AmendProviderArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM financing_provider_onboarding WHERE id = $1 FOR UPDATE",
      [id],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Provider registration not found");
    if (row.status !== "PendingAmendment") throw new DomainError("Can only amend from PendingAmendment");
    if (row.amendment_count >= 5) throw new DomainError("Amendment limit reached");
    if (!args.updatedProviderName) throw new DomainError("Updated provider name must not be empty");
    if (!args.updatedCacRegNumber) throw new DomainError("Updated CAC registration number must not be empty");
    if (args.updatedDeclaredInstruments.length === 0) {
      throw new DomainError("Must declare at least one instrument");
    }

    const { rows: updated } = await client.query(
      `UPDATE financing_provider_onboarding
         SET provider_name = $2, address = $3, cac_reg_number = $4, license_number = $5,
             governing_doc_ref = $6, declared_instruments = $7, status = 'Draft',
             amendment_count = amendment_count + 1,
             agent_score = NULL, agent_risk = NULL, agent_note = NULL, agent_version = NULL,
             updated_at = now()
         WHERE id = $1
         RETURNING id, status, amendment_count`,
      [
        id,
        args.updatedProviderName,
        args.updatedAddress,
        args.updatedCacRegNumber,
        args.updatedLicenseNumber ?? null,
        JSON.stringify(args.updatedGoverningDocRef),
        JSON.stringify(args.updatedDeclaredInstruments),
      ],
    );
    return updated[0];
  });
}
export const amendProvider = withAuthorization(["financialInstitution"], amendProviderImpl);

// ─── Choice: ApproveProvider (vetify) ──────────────────────────────────────

interface ApproveProviderArgs {
  approvedInstruments: string[];
  regulator?: string | null;
}

async function approveProviderImpl(session: SessionContext, id: number, args: ApproveProviderArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM financing_provider_onboarding WHERE id = $1 FOR UPDATE",
      [id],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Provider registration not found");
    if (!REVIEWABLE_STATUSES.includes(row.status)) {
      throw new DomainError("Can only approve from UnderReview or ManualReview");
    }
    if (args.approvedInstruments.length === 0) {
      throw new DomainError("Must approve at least one financing instrument");
    }

    const { rows: approved } = await client.query(
      `INSERT INTO approved_provider
         (financing_provider_onboarding_id, provider_name, provider_type, regulatory_body,
          license_number, approved_instruments, regulator)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        id,
        row.provider_name,
        row.provider_type,
        row.regulatory_body,
        row.license_number,
        JSON.stringify(args.approvedInstruments),
        args.regulator ?? null,
      ],
    );
    const approvedProviderId = approved[0].id;

    await client.query(
      `UPDATE financing_provider_onboarding
         SET status = 'Approved', archived_at = now(),
             superseded_by_kind = 'approved_provider', superseded_by_id = $2, updated_at = now()
         WHERE id = $1`,
      [id, approvedProviderId],
    );

    return { approvedProviderId };
  });
}
export const approveProvider = withAuthorization(["vetify"], approveProviderImpl);

// ─── Choice: RejectProvider (vetify) ───────────────────────────────────────

interface RejectProviderArgs {
  reason: string;
  agentScore?: number | null;
  agentRisk?: string | null;
  agentVersion?: string | null;
  policyId?: number | null;
}

async function rejectProviderImpl(session: SessionContext, id: number, args: RejectProviderArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM financing_provider_onboarding WHERE id = $1 FOR UPDATE",
      [id],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Provider registration not found");
    if (!REVIEWABLE_STATUSES.includes(row.status)) {
      throw new DomainError("Can only reject from UnderReview or ManualReview");
    }
    if (!args.reason) throw new DomainError("Rejection reason must not be empty");

    if (args.agentScore != null && args.policyId != null) {
      const { rows: policyRows } = await client.query(
        "SELECT auto_reject_max FROM provider_verification_policy WHERE id = $1",
        [args.policyId],
      );
      const policy = policyRows[0];
      if (policy && !(args.agentScore <= policy.auto_reject_max)) {
        throw new DomainError("Auto-rejected score is above the active policy's auto-reject threshold");
      }
    }

    const { rows: rejection } = await client.query(
      `INSERT INTO provider_rejection_record
         (financing_provider_onboarding_id, provider_name, cac_reg_number, reason,
          agent_score, agent_risk, agent_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [id, row.provider_name, row.cac_reg_number, args.reason, args.agentScore ?? null, args.agentRisk ?? null, args.agentVersion ?? null],
    );
    const rejectionId = rejection[0].id;

    await client.query(
      `UPDATE financing_provider_onboarding
         SET status = 'Rejected', archived_at = now(),
             superseded_by_kind = 'provider_rejection_record', superseded_by_id = $2, updated_at = now()
         WHERE id = $1`,
      [id, rejectionId],
    );

    return { providerRejectionRecordId: rejectionId };
  });
}
export const rejectProvider = withAuthorization(["vetify"], rejectProviderImpl);

// ─── ProviderVerificationPolicy: create + UpdatePolicy ─────────────────────
// UpdatePolicy's Daml body is a plain `create this with ...` (same-template
// field replace) -- collapses to a straight UPDATE, same convention as
// AuthorizedOfficer's active-flag flip (see migrations/016's header).

interface ProviderPolicyArgs {
  policyVersion: string;
  autoRejectMax: number;
  effectiveFrom: string;
  scoringWeights: Record<string, number>;
}

async function createProviderVerificationPolicyImpl(session: SessionContext, args: ProviderPolicyArgs) {
  if (!args.policyVersion) throw new DomainError("New policy version must not be empty");
  if (args.autoRejectMax < 0) throw new DomainError("autoRejectMax must not be negative");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO provider_verification_policy (policy_version, auto_reject_max, effective_from, scoring_weights)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [args.policyVersion, args.autoRejectMax, args.effectiveFrom, JSON.stringify(args.scoringWeights)],
    );
    return { id: rows[0].id };
  });
}
export const createProviderVerificationPolicy = withAuthorization(["vetify"], createProviderVerificationPolicyImpl);

async function updateProviderVerificationPolicyImpl(session: SessionContext, id: number, args: ProviderPolicyArgs) {
  if (!args.policyVersion) throw new DomainError("New policy version must not be empty");
  if (args.autoRejectMax < 0) throw new DomainError("autoRejectMax must not be negative");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT id FROM provider_verification_policy WHERE id = $1 FOR UPDATE", [id]);
    if (!rows[0]) throw new DomainError("Provider verification policy not found");

    const { rows: updated } = await client.query(
      `UPDATE provider_verification_policy
         SET policy_version = $2, auto_reject_max = $3, effective_from = $4, scoring_weights = $5, updated_at = now()
         WHERE id = $1
         RETURNING id, policy_version, auto_reject_max`,
      [id, args.policyVersion, args.autoRejectMax, args.effectiveFrom, JSON.stringify(args.scoringWeights)],
    );
    return updated[0];
  });
}
export const updateProviderVerificationPolicy = withAuthorization(["vetify"], updateProviderVerificationPolicyImpl);

// ─── Reads ──────────────────────────────────────────────────────────────

export async function listProviderOnboardings(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM financing_provider_onboarding WHERE archived_at IS NULL ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function getProviderOnboarding(session: SessionContext, id: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM financing_provider_onboarding WHERE id = $1", [id]);
    return rows[0] ?? null;
  });
}

export async function listApprovedProviders(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM approved_provider ORDER BY approved_at DESC");
    return rows;
  });
}

export async function listProviderVerificationPolicies(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM provider_verification_policy ORDER BY created_at DESC");
    return rows;
  });
}
