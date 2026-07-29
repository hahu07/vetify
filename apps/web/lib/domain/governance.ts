import type { SessionContext } from "@/lib/db";
import { withTransaction } from "@/lib/db";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { DomainError } from "@/lib/errors";

// Codegen experiment (docs/web2-migration-design.md's "Codegen Experiment"
// section): the Deactivate*/Reactivate* choice bodies below were generated
// by scripts/codegen/{parseDaml,genSql,genDomain}.ts directly from
// daml/Vetify/Governance.daml, then hand-finished for the parts the
// generator honestly left as TODOs (the `create this with` -> UPDATE
// translation, `t <- getTime` -> `now()`, arg types `unknown` -> `string`)
// plus the register/list functions the generator doesn't produce at all
// (these templates are created directly, not via a Daml choice -- same
// pattern as BusinessOnboarding in Phase 1).

const registryTables = {
  officer: "authorized_officer",
  policyApprover: "policy_approver",
  assessor: "authorized_assessor",
  sentinel: "authorized_sentinel",
  advisor: "authorized_advisor",
  reviewer: "authorized_reviewer",
} as const;

// ─── AuthorizedOfficer (financialInstitution's own staff registry) ────────

interface RegisterOfficerArgs {
  officerId: string;
  officerName: string;
  roles: string[];
  authorizedBy: string;
  approvalLimit?: number | null;
}

async function registerOfficerImpl(session: SessionContext, args: RegisterOfficerArgs) {
  if (!args.officerId) throw new DomainError("officerId must not be empty");
  if (!args.officerName) throw new DomainError("officerName must not be empty");
  if (!args.authorizedBy) throw new DomainError("authorizedBy must not be empty");
  if (args.roles.length === 0) throw new DomainError("An officer must hold at least one role");
  if (args.approvalLimit != null && args.approvalLimit <= 0) {
    throw new DomainError("approvalLimit must be positive when set");
  }
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO authorized_officer (officer_id, officer_name, roles, authorized_by, authorized_at, active, approval_limit)
       VALUES ($1, $2, $3, $4, now(), true, $5) RETURNING id`,
      [args.officerId, args.officerName, JSON.stringify(args.roles), args.authorizedBy, args.approvalLimit ?? null],
    );
    return { id: rows[0].id };
  });
}
export const registerOfficer = withAuthorization(["financialInstitution"], registerOfficerImpl);

// Generated from AuthorizedOfficer.DeactivateOfficer by scripts/codegen/genDomain.ts.
async function deactivateOfficerImpl(session: SessionContext, id: number, args: { reason: string; performedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM authorized_officer WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("AuthorizedOfficer not found");
    if (!(args.reason !== "")) throw new DomainError("Reason must not be empty");
    if (!(args.performedBy !== "")) throw new DomainError("performedBy must not be empty");
    if (!row.active) throw new DomainError(`Officer is already inactive`);
    const { rows: updated } = await client.query(
      `UPDATE authorized_officer
         SET active = false, last_updated_by = $2, last_updated_at = now(), status_reason = $3, updated_at = now()
         WHERE id = $1 RETURNING id, active`,
      [id, args.performedBy, args.reason],
    );
    return updated[0];
  });
}
export const deactivateOfficer = withAuthorization(["financialInstitution"], deactivateOfficerImpl);

// Generated from AuthorizedOfficer.ReactivateOfficer by scripts/codegen/genDomain.ts.
async function reactivateOfficerImpl(session: SessionContext, id: number, args: { reason: string; performedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM authorized_officer WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("AuthorizedOfficer not found");
    if (!(args.reason !== "")) throw new DomainError("Reason must not be empty");
    if (!(args.performedBy !== "")) throw new DomainError("performedBy must not be empty");
    if (!!row.active) throw new DomainError(`Officer is already active`);
    const { rows: updated } = await client.query(
      `UPDATE authorized_officer
         SET active = true, last_updated_by = $2, last_updated_at = now(), status_reason = $3, updated_at = now()
         WHERE id = $1 RETURNING id, active`,
      [id, args.performedBy, args.reason],
    );
    return updated[0];
  });
}
export const reactivateOfficer = withAuthorization(["financialInstitution"], reactivateOfficerImpl);

/** Ported from Vetify.Governance's requireActiveOfficer -- fails closed
 * unless officerId is a currently-active AuthorizedOfficer holding
 * expectedRole. No validUntil/expiry column exists in this schema (the
 * Daml original's optional expiry check is skipped, not silently ignored --
 * this migration's authorized_officer table was never given that column),
 * so this checks active + role membership only. First consumer:
 * murabahah.ts's grantIbra four-eyes check. */
export async function requireActiveOfficerWithRole(session: SessionContext, officerId: string, expectedRole: string): Promise<void> {
  await withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT active, roles FROM authorized_officer WHERE officer_id = $1", [officerId]);
    const officer = rows[0];
    if (!officer) throw new DomainError(`Officer ${officerId} not found`);
    if (!officer.active) throw new DomainError(`Officer ${officerId} is not active`);
    const roles: string[] = officer.roles ?? [];
    if (!roles.includes(expectedRole)) throw new DomainError(`Officer ${officerId} does not hold the required role`);
  });
}

// ─── PolicyApprover (vetify's own risk-governance registry) ───────────────

async function registerPolicyApproverImpl(session: SessionContext, args: { approverName: string; role: string; authorizedBy: string }) {
  if (!args.approverName) throw new DomainError("approverName must not be empty");
  if (!args.role) throw new DomainError("role must not be empty");
  if (!args.authorizedBy) throw new DomainError("authorizedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO policy_approver (approver_name, role, authorized_by, authorized_at, active)
       VALUES ($1, $2, $3, now(), true) RETURNING id`,
      [args.approverName, args.role, args.authorizedBy],
    );
    return { id: rows[0].id };
  });
}
export const registerPolicyApprover = withAuthorization(["vetify"], registerPolicyApproverImpl);

// Generated from PolicyApprover.DeactivatePolicyApprover by scripts/codegen/genDomain.ts.
async function deactivatePolicyApproverImpl(session: SessionContext, id: number, args: { reason: string; performedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM policy_approver WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("PolicyApprover not found");
    if (!(args.reason !== "")) throw new DomainError("Reason must not be empty");
    if (!(args.performedBy !== "")) throw new DomainError("performedBy must not be empty");
    if (!row.active) throw new DomainError(`Approver is already inactive`);
    const { rows: updated } = await client.query(
      `UPDATE policy_approver SET active = false, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [id],
    );
    return updated[0];
  });
}
export const deactivatePolicyApprover = withAuthorization(["vetify"], deactivatePolicyApproverImpl);

// Generated from PolicyApprover.ReactivatePolicyApprover by scripts/codegen/genDomain.ts.
async function reactivatePolicyApproverImpl(session: SessionContext, id: number, args: { reason: string; performedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM policy_approver WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("PolicyApprover not found");
    if (!(args.reason !== "")) throw new DomainError("Reason must not be empty");
    if (!(args.performedBy !== "")) throw new DomainError("performedBy must not be empty");
    if (!!row.active) throw new DomainError(`Approver is already active`);
    const { rows: updated } = await client.query(
      `UPDATE policy_approver SET active = true, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [id],
    );
    return updated[0];
  });
}
export const reactivatePolicyApprover = withAuthorization(["vetify"], reactivatePolicyApproverImpl);

// ─── AuthorizedAssessor / AuthorizedSentinel / AuthorizedAdvisor ───────────
// Identically-shaped registries (vetify signs, the named party observes);
// genuinely near-duplicate code below, kept unabstracted on purpose --
// it's a direct, checkable translation of three near-duplicate Daml
// templates, not a place to introduce a shared abstraction the Daml
// original doesn't have either.

async function registerAssessorImpl(session: SessionContext, args: { assessor: string; role: string; authorizedBy: string }) {
  if (!args.role) throw new DomainError("role must not be empty");
  if (!args.authorizedBy) throw new DomainError("authorizedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO authorized_assessor (assessor, role, authorized_by, authorized_at, active)
       VALUES ($1, $2, $3, now(), true) RETURNING id`,
      [args.assessor, args.role, args.authorizedBy],
    );
    return { id: rows[0].id };
  });
}
export const registerAssessor = withAuthorization(["vetify"], registerAssessorImpl);

async function deactivateAssessorImpl(session: SessionContext, id: number, args: { reason: string; performedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM authorized_assessor WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("AuthorizedAssessor not found");
    if (!(args.reason !== "")) throw new DomainError("Reason must not be empty");
    if (!(args.performedBy !== "")) throw new DomainError("performedBy must not be empty");
    if (!row.active) throw new DomainError(`Assessor is already inactive`);
    const { rows: updated } = await client.query(
      `UPDATE authorized_assessor SET active = false, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [id],
    );
    return updated[0];
  });
}
export const deactivateAssessor = withAuthorization(["vetify"], deactivateAssessorImpl);

async function reactivateAssessorImpl(session: SessionContext, id: number, args: { reason: string; performedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM authorized_assessor WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("AuthorizedAssessor not found");
    if (!(args.reason !== "")) throw new DomainError("Reason must not be empty");
    if (!(args.performedBy !== "")) throw new DomainError("performedBy must not be empty");
    if (!!row.active) throw new DomainError(`Assessor is already active`);
    const { rows: updated } = await client.query(
      `UPDATE authorized_assessor SET active = true, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [id],
    );
    return updated[0];
  });
}
export const reactivateAssessor = withAuthorization(["vetify"], reactivateAssessorImpl);

/** Fails closed if `assessorId` isn't a currently-active AuthorizedAssessor row -- the registry gate Phase 2's Financing pass deferred wiring into beginUnderwriting/rejectUnderwriting. */
export async function requireActiveAssessor(session: SessionContext, assessorId: number): Promise<void> {
  await withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT active FROM authorized_assessor WHERE id = $1", [assessorId]);
    if (!rows[0] || !rows[0].active) throw new DomainError("Assessor is not active");
  });
}

async function registerSentinelImpl(session: SessionContext, args: { sentinel: string; role: string; authorizedBy: string }) {
  if (!args.role) throw new DomainError("role must not be empty");
  if (!args.authorizedBy) throw new DomainError("authorizedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO authorized_sentinel (sentinel, role, authorized_by, authorized_at, active)
       VALUES ($1, $2, $3, now(), true) RETURNING id`,
      [args.sentinel, args.role, args.authorizedBy],
    );
    return { id: rows[0].id };
  });
}
export const registerSentinel = withAuthorization(["vetify"], registerSentinelImpl);

async function deactivateSentinelImpl(session: SessionContext, id: number, args: { reason: string; performedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM authorized_sentinel WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("AuthorizedSentinel not found");
    if (!(args.reason !== "")) throw new DomainError("Reason must not be empty");
    if (!(args.performedBy !== "")) throw new DomainError("performedBy must not be empty");
    if (!row.active) throw new DomainError(`Sentinel is already inactive`);
    const { rows: updated } = await client.query(
      `UPDATE authorized_sentinel SET active = false, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [id],
    );
    return updated[0];
  });
}
export const deactivateSentinel = withAuthorization(["vetify"], deactivateSentinelImpl);

async function reactivateSentinelImpl(session: SessionContext, id: number, args: { reason: string; performedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM authorized_sentinel WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("AuthorizedSentinel not found");
    if (!(args.reason !== "")) throw new DomainError("Reason must not be empty");
    if (!(args.performedBy !== "")) throw new DomainError("performedBy must not be empty");
    if (!!row.active) throw new DomainError(`Sentinel is already active`);
    const { rows: updated } = await client.query(
      `UPDATE authorized_sentinel SET active = true, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [id],
    );
    return updated[0];
  });
}
export const reactivateSentinel = withAuthorization(["vetify"], reactivateSentinelImpl);

/** Fails closed if `sentinelId` isn't a currently-active AuthorizedSentinel row -- the registry gate the codegen pass wrote register/deactivate/reactivate for but never wired a require* function for, unlike its assessor/advisor counterparts. Wired into flagDelinquent/resumeActive (Stage 9-10). */
export async function requireActiveSentinel(session: SessionContext, sentinelId: number): Promise<void> {
  await withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT active FROM authorized_sentinel WHERE id = $1", [sentinelId]);
    if (!rows[0] || !rows[0].active) throw new DomainError("Sentinel is not active");
  });
}

async function registerAdvisorImpl(session: SessionContext, args: { advisor: string; role: string; authorizedBy: string }) {
  if (!args.role) throw new DomainError("role must not be empty");
  if (!args.authorizedBy) throw new DomainError("authorizedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO authorized_advisor (advisor, role, authorized_by, authorized_at, active)
       VALUES ($1, $2, $3, now(), true) RETURNING id`,
      [args.advisor, args.role, args.authorizedBy],
    );
    return { id: rows[0].id };
  });
}
export const registerAdvisor = withAuthorization(["vetify"], registerAdvisorImpl);

async function deactivateAdvisorImpl(session: SessionContext, id: number, args: { reason: string; performedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM authorized_advisor WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("AuthorizedAdvisor not found");
    if (!(args.reason !== "")) throw new DomainError("Reason must not be empty");
    if (!(args.performedBy !== "")) throw new DomainError("performedBy must not be empty");
    if (!row.active) throw new DomainError(`Advisor is already inactive`);
    const { rows: updated } = await client.query(
      `UPDATE authorized_advisor SET active = false, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [id],
    );
    return updated[0];
  });
}
export const deactivateAdvisor = withAuthorization(["vetify"], deactivateAdvisorImpl);

async function reactivateAdvisorImpl(session: SessionContext, id: number, args: { reason: string; performedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM authorized_advisor WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("AuthorizedAdvisor not found");
    if (!(args.reason !== "")) throw new DomainError("Reason must not be empty");
    if (!(args.performedBy !== "")) throw new DomainError("performedBy must not be empty");
    if (!!row.active) throw new DomainError(`Advisor is already active`);
    const { rows: updated } = await client.query(
      `UPDATE authorized_advisor SET active = true, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [id],
    );
    return updated[0];
  });
}
export const reactivateAdvisor = withAuthorization(["vetify"], reactivateAdvisorImpl);

/** Fails closed if `advisorId` isn't a currently-active AuthorizedAdvisor row -- the registry gate Phase 2's Murabahah pass deferred wiring into certifyShariahTerms. */
export async function requireActiveAdvisor(session: SessionContext, advisorId: number): Promise<void> {
  await withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT active FROM authorized_advisor WHERE id = $1", [advisorId]);
    if (!rows[0] || !rows[0].active) throw new DomainError("Advisor is not active");
  });
}

// ─── AuthorizedReviewer (Phase 2, Sixteenth Slice) ─────────────────────────
// Only a single one-way Deauthorize choice in the real Daml -- see
// migrations/019's header for why this doesn't get a Reactivate the other
// four registries above have.

async function registerReviewerImpl(session: SessionContext, args: { role: string; authorizedBy: string }) {
  if (!args.role) throw new DomainError("role must not be empty");
  if (!args.authorizedBy) throw new DomainError("authorizedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO authorized_reviewer (role, authorized_by, authorized_at)
       VALUES ($1, $2, now()) RETURNING id`,
      [args.role, args.authorizedBy],
    );
    return { id: rows[0].id };
  });
}
export const registerReviewer = withAuthorization(["vetify"], registerReviewerImpl);

async function deauthorizeReviewerImpl(session: SessionContext, id: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT archived_at FROM authorized_reviewer WHERE id = $1 FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new DomainError("AuthorizedReviewer not found");
    if (row.archived_at) throw new DomainError("Reviewer is already deauthorized");

    const { rows: updated } = await client.query(
      `UPDATE authorized_reviewer SET archived_at = now() WHERE id = $1 RETURNING id, archived_at`,
      [id],
    );
    return updated[0];
  });
}
export const deauthorizeReviewer = withAuthorization(["vetify"], deauthorizeReviewerImpl);

// ─── Reads ──────────────────────────────────────────────────────────────

export async function listRegistry(session: SessionContext, registry: keyof typeof registryTables) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM ${registryTables[registry]} ORDER BY created_at DESC`);
    return rows;
  });
}
