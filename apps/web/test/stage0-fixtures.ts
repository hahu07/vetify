import type { Client } from "pg";

// Shared by every Murabahah test file's fixture-building helper: since the
// design doc's "wiring ApprovedProvider/AuthorizedOfficer into
// approveFundingImpl" pass, ApproveFunding now hard-requires a real,
// Murabahah-approved ApprovedProvider row and a real, active CreditOfficer
// row (see migrations/016 + lib/domain/financing.ts's own header) --
// something none of these test files' fixtures had needed to set up
// before. Idempotent and process-wide (a fixed, well-known identifier
// pair, `SELECT`-then-`INSERT`-if-missing) rather than a fresh row per
// test file, since every caller wants the identical minimal "yes, this FI
// may legitimately do this" credential and there's nothing under test in
// the credential itself here -- unlike the codebase's per-test unique-tag
// convention for fixtures whose *identity* is what a test is asserting
// against.
const SHARED_OFFICER_ID = "SHARED-TEST-CREDIT-OFFICER";
const SHARED_PROVIDER_CAC = "SHARED-TEST-PROVIDER";

export async function ensureStage0ApprovalFixtures(
  client: Client,
): Promise<{ approvedProviderId: number; approvingOfficerId: string }> {
  await client.query(
    `INSERT INTO authorized_officer (officer_id, officer_name, roles, authorized_by, authorized_at, active)
     SELECT $1, 'Shared Test Credit Officer', '["CreditOfficer"]', 'Test Setup', now(), true
     WHERE NOT EXISTS (SELECT 1 FROM authorized_officer WHERE officer_id = $1)`,
    [SHARED_OFFICER_ID],
  );

  const existing = await client.query(
    `SELECT ap.id FROM approved_provider ap
       JOIN financing_provider_onboarding o ON o.id = ap.financing_provider_onboarding_id
      WHERE o.cac_reg_number = $1`,
    [SHARED_PROVIDER_CAC],
  );
  if (existing.rows[0]) {
    return { approvedProviderId: existing.rows[0].id, approvingOfficerId: SHARED_OFFICER_ID };
  }

  const onboarding = await client.query(
    `INSERT INTO financing_provider_onboarding
       (provider_name, address, cac_reg_number, provider_type, governing_doc_ref, declared_instruments, archived_at)
     VALUES ('Shared Test Provider', 'Lagos', $1, 'CooperativeSociety', '{}', '["Murabahah"]', now())
     RETURNING id`,
    [SHARED_PROVIDER_CAC],
  );
  const approved = await client.query(
    `INSERT INTO approved_provider (financing_provider_onboarding_id, provider_name, provider_type, approved_instruments)
     VALUES ($1, 'Shared Test Provider', 'CooperativeSociety', '["Murabahah"]')
     RETURNING id`,
    [onboarding.rows[0].id],
  );
  return { approvedProviderId: approved.rows[0].id, approvingOfficerId: SHARED_OFFICER_ID };
}
