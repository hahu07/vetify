import type { SessionContext } from "@/lib/db";
import { withTransaction } from "@/lib/db";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { DomainError } from "@/lib/errors";

// Phase 2, Fourteenth Slice (web2-migration-design.md): the VerificationPolicy/
// CompliancePolicy maker-checker chain, ported from daml/Vetify/Onboarding.daml
// and daml/Vetify/Compliance.daml. See migrations/017's header for what's
// deliberately out of scope (AuthorizedReviewer, wiring the resulting policy
// rows into any actual scoring decision -- this migration has no LLM/agent
// integration at all yet).
//
// requireActivePolicyApprover's Postgres equivalent -- reused by both
// approveVerificationPolicyChange and approveCompliancePolicyChange, mirroring
// how the real Daml helper (Vetify.Governance) is shared by both
// PendingVerificationPolicy.ApprovePolicyChange and
// PendingCompliancePolicy.ApprovePolicyChange.
async function requireActivePolicyApproverInline(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ active: boolean }> }> },
  approverName: string,
): Promise<void> {
  const { rows } = await client.query(
    "SELECT active FROM policy_approver WHERE approver_name = $1",
    [approverName],
  );
  const approver = rows[0];
  if (!approver) throw new DomainError(`Approver ${approverName} not found`);
  if (!approver.active) throw new DomainError(`Approver ${approverName} is not active`);
}

interface ScoringWeights {
  [key: string]: number;
}

// ─── VerificationPolicy / PendingVerificationPolicy ────────────────────────

interface ProposeVerificationPolicyArgs {
  maxAmendments: number;
  slaHours: number;
  autoApproveMin: number;
  autoRejectMax: number;
  requiredDocTypes: string[];
  policyVersion: string;
  scoringWeights: ScoringWeights;
  proposedBy: string;
  reason: string;
}

function validateVerificationPolicyFields(args: {
  maxAmendments: number;
  slaHours: number;
  autoApproveMin: number;
  autoRejectMax: number;
  policyVersion: string;
}): void {
  if (args.maxAmendments <= 0) throw new DomainError("maxAmendments must be positive");
  if (args.slaHours <= 0) throw new DomainError("slaHours must be positive");
  if (args.autoApproveMin <= args.autoRejectMax) {
    throw new DomainError("autoApproveMin must be greater than autoRejectMax");
  }
  if (args.autoApproveMin > 100) throw new DomainError("autoApproveMin must be at most 100");
  if (args.autoRejectMax < 0) throw new DomainError("autoRejectMax must not be negative");
  if (!args.policyVersion) throw new DomainError("policyVersion must not be empty");
}

async function proposeVerificationPolicyImpl(session: SessionContext, args: ProposeVerificationPolicyArgs) {
  validateVerificationPolicyFields(args);
  if (!args.proposedBy) throw new DomainError("proposedBy must not be empty");
  if (!args.reason) throw new DomainError("reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO pending_verification_policy
         (max_amendments, sla_hours, auto_approve_min, auto_reject_max, required_doc_types,
          policy_version, scoring_weights, proposed_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        args.maxAmendments, args.slaHours, args.autoApproveMin, args.autoRejectMax,
        JSON.stringify(args.requiredDocTypes), args.policyVersion, JSON.stringify(args.scoringWeights),
        args.proposedBy, args.reason,
      ],
    );
    return { id: rows[0].id };
  });
}
export const proposeVerificationPolicy = withAuthorization(["vetify"], proposeVerificationPolicyImpl);

async function endorseVerificationPolicyImpl(session: SessionContext, id: number, args: { endorsedBy: string }) {
  if (!args.endorsedBy) throw new DomainError("endorsedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM pending_verification_policy WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("PendingVerificationPolicy not found");
    if (row.archived_at) throw new DomainError("PendingVerificationPolicy is no longer active");
    if (row.risk_committee_endorsed_by != null) throw new DomainError("Already endorsed by the Risk Committee");

    const { rows: updated } = await client.query(
      `UPDATE pending_verification_policy
         SET risk_committee_endorsed_by = $2, risk_committee_endorsed_at = now()
         WHERE id = $1
         RETURNING id, risk_committee_endorsed_by, risk_committee_endorsed_at`,
      [id, args.endorsedBy],
    );
    return updated[0];
  });
}
export const endorseVerificationPolicy = withAuthorization(["riskCommittee"], endorseVerificationPolicyImpl);

async function approveVerificationPolicyChangeImpl(session: SessionContext, id: number, args: { approvedBy: string }) {
  if (!args.approvedBy) throw new DomainError("approvedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM pending_verification_policy WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("PendingVerificationPolicy not found");
    if (row.archived_at) throw new DomainError("PendingVerificationPolicy is no longer active");
    if (args.approvedBy === row.proposed_by) {
      throw new DomainError("Approver must differ from proposer (maker-checker)");
    }
    await requireActivePolicyApproverInline(client, args.approvedBy);
    if (row.risk_committee_endorsed_by == null) {
      throw new DomainError("Risk Committee must endorse this change before vetify can approve it");
    }

    await client.query(
      `UPDATE verification_policy SET archived_at = now() WHERE archived_at IS NULL`,
    );
    const { rows: created } = await client.query(
      `INSERT INTO verification_policy
         (max_amendments, sla_hours, auto_approve_min, auto_reject_max, required_doc_types, policy_version, scoring_weights)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        row.max_amendments, row.sla_hours, row.auto_approve_min, row.auto_reject_max,
        JSON.stringify(row.required_doc_types), row.policy_version, JSON.stringify(row.scoring_weights),
      ],
    );
    const newPolicyId = created[0].id;

    await client.query(
      `UPDATE pending_verification_policy
         SET archived_at = now(), superseded_by_kind = 'verification_policy', superseded_by_id = $2
         WHERE id = $1`,
      [id, newPolicyId],
    );

    return { verificationPolicyId: newPolicyId };
  });
}
export const approveVerificationPolicyChange = withAuthorization(["vetify"], approveVerificationPolicyChangeImpl);

async function rejectVerificationPolicyChangeImpl(
  session: SessionContext,
  id: number,
  args: { rejectedBy: string; rejectionReason: string },
) {
  if (!args.rejectedBy) throw new DomainError("rejectedBy must not be empty");
  if (!args.rejectionReason) throw new DomainError("rejectionReason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT archived_at FROM pending_verification_policy WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("PendingVerificationPolicy not found");
    if (row.archived_at) throw new DomainError("PendingVerificationPolicy is no longer active");

    await client.query(
      `UPDATE pending_verification_policy SET archived_at = now() WHERE id = $1`,
      [id],
    );
    return { id };
  });
}
export const rejectVerificationPolicyChange = withAuthorization(["vetify"], rejectVerificationPolicyChangeImpl);

// ─── CompliancePolicy / PendingCompliancePolicy ────────────────────────────
// Identically-shaped to the VerificationPolicy chain above -- genuinely
// near-duplicate, kept unabstracted on purpose, same discipline
// governance.ts's AuthorizedAssessor/Sentinel/Advisor registries already
// established: a direct, checkable translation of two near-duplicate Daml
// templates is worth more here than a shared generic "policy chain" helper.

interface ProposeCompliancePolicyArgs {
  autoApproveMin: number;
  autoRejectMax: number;
  escalationSlaHours: number;
  shariahPolicyVersion: string;
  policyVersion: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  scoringWeights: ScoringWeights;
  proposedBy: string;
  reason: string;
}

function validateCompliancePolicyFields(args: {
  autoApproveMin: number;
  autoRejectMax: number;
  escalationSlaHours: number;
  shariahPolicyVersion: string;
  policyVersion: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}): void {
  if (args.autoApproveMin <= args.autoRejectMax) {
    throw new DomainError("autoApproveMin must be greater than autoRejectMax");
  }
  if (args.autoApproveMin < 0 || args.autoApproveMin > 100) throw new DomainError("autoApproveMin must be between 0 and 100");
  if (args.autoRejectMax < 0 || args.autoRejectMax > 100) throw new DomainError("autoRejectMax must be between 0 and 100");
  if (args.escalationSlaHours <= 0) throw new DomainError("escalationSlaHours must be positive");
  if (!args.shariahPolicyVersion) throw new DomainError("shariahPolicyVersion must not be empty");
  if (!args.policyVersion) throw new DomainError("policyVersion must not be empty");
  if (args.effectiveTo != null && new Date(args.effectiveFrom).getTime() >= new Date(args.effectiveTo).getTime()) {
    throw new DomainError("effectiveFrom must be before effectiveTo");
  }
}

async function proposeCompliancePolicyImpl(session: SessionContext, args: ProposeCompliancePolicyArgs) {
  validateCompliancePolicyFields(args);
  if (!args.proposedBy) throw new DomainError("proposedBy must not be empty");
  if (!args.reason) throw new DomainError("reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO pending_compliance_policy
         (auto_approve_min, auto_reject_max, escalation_sla_hours, shariah_policy_version, policy_version,
          effective_from, effective_to, scoring_weights, proposed_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        args.autoApproveMin, args.autoRejectMax, args.escalationSlaHours, args.shariahPolicyVersion, args.policyVersion,
        args.effectiveFrom, args.effectiveTo ?? null, JSON.stringify(args.scoringWeights), args.proposedBy, args.reason,
      ],
    );
    return { id: rows[0].id };
  });
}
export const proposeCompliancePolicy = withAuthorization(["vetify"], proposeCompliancePolicyImpl);

async function endorseCompliancePolicyImpl(session: SessionContext, id: number, args: { endorsedBy: string }) {
  if (!args.endorsedBy) throw new DomainError("endorsedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM pending_compliance_policy WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("PendingCompliancePolicy not found");
    if (row.archived_at) throw new DomainError("PendingCompliancePolicy is no longer active");
    if (row.risk_committee_endorsed_by != null) throw new DomainError("Already endorsed by the Risk Committee");

    const { rows: updated } = await client.query(
      `UPDATE pending_compliance_policy
         SET risk_committee_endorsed_by = $2, risk_committee_endorsed_at = now()
         WHERE id = $1
         RETURNING id, risk_committee_endorsed_by, risk_committee_endorsed_at`,
      [id, args.endorsedBy],
    );
    return updated[0];
  });
}
export const endorseCompliancePolicy = withAuthorization(["riskCommittee"], endorseCompliancePolicyImpl);

async function approveCompliancePolicyChangeImpl(session: SessionContext, id: number, args: { approvedBy: string }) {
  if (!args.approvedBy) throw new DomainError("approvedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM pending_compliance_policy WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("PendingCompliancePolicy not found");
    if (row.archived_at) throw new DomainError("PendingCompliancePolicy is no longer active");
    if (args.approvedBy === row.proposed_by) {
      throw new DomainError("Approver must differ from proposer (maker-checker)");
    }
    await requireActivePolicyApproverInline(client, args.approvedBy);
    if (row.risk_committee_endorsed_by == null) {
      throw new DomainError("Risk Committee must endorse this change before vetify can approve it");
    }

    await client.query(
      `UPDATE compliance_policy SET archived_at = now() WHERE archived_at IS NULL`,
    );
    const { rows: created } = await client.query(
      `INSERT INTO compliance_policy
         (auto_approve_min, auto_reject_max, escalation_sla_hours, shariah_policy_version, policy_version,
          effective_from, effective_to, scoring_weights)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        row.auto_approve_min, row.auto_reject_max, row.escalation_sla_hours, row.shariah_policy_version,
        row.policy_version, row.effective_from, row.effective_to, JSON.stringify(row.scoring_weights),
      ],
    );
    const newPolicyId = created[0].id;

    await client.query(
      `UPDATE pending_compliance_policy
         SET archived_at = now(), superseded_by_kind = 'compliance_policy', superseded_by_id = $2
         WHERE id = $1`,
      [id, newPolicyId],
    );

    return { compliancePolicyId: newPolicyId };
  });
}
export const approveCompliancePolicyChange = withAuthorization(["vetify"], approveCompliancePolicyChangeImpl);

async function rejectCompliancePolicyChangeImpl(
  session: SessionContext,
  id: number,
  args: { rejectedBy: string; rejectionReason: string },
) {
  if (!args.rejectedBy) throw new DomainError("rejectedBy must not be empty");
  if (!args.rejectionReason) throw new DomainError("rejectionReason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT archived_at FROM pending_compliance_policy WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("PendingCompliancePolicy not found");
    if (row.archived_at) throw new DomainError("PendingCompliancePolicy is no longer active");

    await client.query(
      `UPDATE pending_compliance_policy SET archived_at = now() WHERE id = $1`,
      [id],
    );
    return { id };
  });
}
export const rejectCompliancePolicyChange = withAuthorization(["vetify"], rejectCompliancePolicyChangeImpl);

// ─── Reads ──────────────────────────────────────────────────────────────

export async function listVerificationPolicies(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM verification_policy ORDER BY created_at DESC");
    return rows;
  });
}

export async function listPendingVerificationPolicies(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM pending_verification_policy WHERE archived_at IS NULL ORDER BY proposed_at DESC",
    );
    return rows;
  });
}

export async function listCompliancePolicies(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM compliance_policy ORDER BY created_at DESC");
    return rows;
  });
}

export async function listPendingCompliancePolicies(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM pending_compliance_policy WHERE archived_at IS NULL ORDER BY proposed_at DESC",
    );
    return rows;
  });
}
