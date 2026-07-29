// Tests for lib/domain/governance.ts -- the codegen experiment
// (docs/web2-migration-design.md's "Codegen Experiment" section). Proves
// the generated-then-hand-finished Deactivate*/Reactivate* guards for all
// five registries actually work end-to-end against the real database, not
// just that they compile.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { AuthorizationError, DomainError } from "@/lib/errors";
import {
  registerOfficer,
  deactivateOfficer,
  reactivateOfficer,
  registerPolicyApprover,
  deactivatePolicyApprover,
  reactivatePolicyApprover,
  registerAssessor,
  deactivateAssessor,
  reactivateAssessor,
  requireActiveAssessor,
  registerSentinel,
  deactivateSentinel,
  reactivateSentinel,
  registerAdvisor,
  deactivateAdvisor,
  reactivateAdvisor,
  requireActiveAdvisor,
} from "@/lib/domain/governance";

function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
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

async function cleanup(table: string, idColumnValue: string) {
  await fixtureClient.query(`DELETE FROM ${table} WHERE authorized_by = $1`, [idColumnValue]);
}

// ─── AuthorizedOfficer ──────────────────────────────────────────────────────

test("registerOfficer + deactivateOfficer + reactivateOfficer: full lifecycle", async () => {
  const tag = "TEST-OFFICER-1";
  try {
    const created = await registerOfficer(fiSession(), {
      officerId: "OFF-001",
      officerName: "Test Officer",
      roles: ["CreditOfficer"],
      authorizedBy: tag,
    });
    const deactivated = await deactivateOfficer(fiSession(), created.id, { reason: "Left the company", performedBy: "Manager" });
    assert.equal(deactivated.active, false);
    await assert.rejects(
      () => deactivateOfficer(fiSession(), created.id, { reason: "again", performedBy: "Manager" }),
      (err: unknown) => err instanceof DomainError && err.message === "Officer is already inactive",
    );
    const reactivated = await reactivateOfficer(fiSession(), created.id, { reason: "Rehired", performedBy: "Manager" });
    assert.equal(reactivated.active, true);
    await assert.rejects(
      () => reactivateOfficer(fiSession(), created.id, { reason: "again", performedBy: "Manager" }),
      (err: unknown) => err instanceof DomainError && err.message === "Officer is already active",
    );
  } finally {
    await cleanup("authorized_officer", tag);
  }
});

test("registerOfficer: rejects zero roles", async () => {
  await assert.rejects(
    () => registerOfficer(fiSession(), { officerId: "OFF-002", officerName: "Test", roles: [], authorizedBy: "Manager" }),
    (err: unknown) => err instanceof DomainError && err.message === "An officer must hold at least one role",
  );
});

test("registerOfficer: withAuthorization rejects a non-financialInstitution session", async () => {
  await assert.rejects(
    () => registerOfficer(vetifySession(), { officerId: "OFF-003", officerName: "Test", roles: ["CreditOfficer"], authorizedBy: "Manager" }),
    AuthorizationError,
  );
});

// ─── PolicyApprover ─────────────────────────────────────────────────────────

test("registerPolicyApprover + deactivate + reactivate: full lifecycle", async () => {
  const tag = "TEST-APPROVER-1";
  try {
    const created = await registerPolicyApprover(vetifySession(), { approverName: "Jane Risk", role: "Head of Risk", authorizedBy: tag });
    const deactivated = await deactivatePolicyApprover(vetifySession(), created.id, { reason: "Left committee", performedBy: "Chair" });
    assert.equal(deactivated.active, false);
    const reactivated = await reactivatePolicyApprover(vetifySession(), created.id, { reason: "Rejoined", performedBy: "Chair" });
    assert.equal(reactivated.active, true);
  } finally {
    await cleanup("policy_approver", tag);
  }
});

// ─── AuthorizedAssessor (also exercises requireActiveAssessor) ─────────────

test("registerAssessor + deactivate + reactivate + requireActiveAssessor: full lifecycle", async () => {
  const tag = "TEST-ASSESSOR-1";
  try {
    const created = await registerAssessor(vetifySession(), { assessor: "assessor", role: "Senior Assessor", authorizedBy: tag });
    await assert.doesNotReject(() => requireActiveAssessor(vetifySession(), created.id));

    await deactivateAssessor(vetifySession(), created.id, { reason: "On leave", performedBy: "Manager" });
    await assert.rejects(
      () => requireActiveAssessor(vetifySession(), created.id),
      (err: unknown) => err instanceof DomainError && err.message === "Assessor is not active",
    );

    const reactivated = await reactivateAssessor(vetifySession(), created.id, { reason: "Back from leave", performedBy: "Manager" });
    assert.equal(reactivated.active, true);
    await assert.doesNotReject(() => requireActiveAssessor(vetifySession(), created.id));
  } finally {
    await cleanup("authorized_assessor", tag);
  }
});

// ─── AuthorizedSentinel ─────────────────────────────────────────────────────

test("registerSentinel + deactivate + reactivate: full lifecycle", async () => {
  const tag = "TEST-SENTINEL-1";
  try {
    const created = await registerSentinel(vetifySession(), { sentinel: "sentinel", role: "Senior Portfolio Analyst", authorizedBy: tag });
    const deactivated = await deactivateSentinel(vetifySession(), created.id, { reason: "Reassigned", performedBy: "Manager" });
    assert.equal(deactivated.active, false);
    const reactivated = await reactivateSentinel(vetifySession(), created.id, { reason: "Reassigned back", performedBy: "Manager" });
    assert.equal(reactivated.active, true);
  } finally {
    await cleanup("authorized_sentinel", tag);
  }
});

// ─── AuthorizedAdvisor (also exercises requireActiveAdvisor) ───────────────

test("registerAdvisor + deactivate + reactivate + requireActiveAdvisor: full lifecycle", async () => {
  const tag = "TEST-ADVISOR-1";
  try {
    const created = await registerAdvisor(vetifySession(), { advisor: "advisor", role: "Fiqh Scholar", authorizedBy: tag });
    await assert.doesNotReject(() => requireActiveAdvisor(vetifySession(), created.id));

    await deactivateAdvisor(vetifySession(), created.id, { reason: "Term ended", performedBy: "SSB Chair" });
    await assert.rejects(
      () => requireActiveAdvisor(vetifySession(), created.id),
      (err: unknown) => err instanceof DomainError && err.message === "Advisor is not active",
    );

    const reactivated = await reactivateAdvisor(vetifySession(), created.id, { reason: "Renewed term", performedBy: "SSB Chair" });
    assert.equal(reactivated.active, true);
  } finally {
    await cleanup("authorized_advisor", tag);
  }
});
