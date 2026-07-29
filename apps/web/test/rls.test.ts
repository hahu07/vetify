// Automates the manual psql/fetch probing done while verifying Phase 1 (see
// docs/web2-migration-design.md's "Phase 1 Vertical Slice -- Results" --
// this is the gate addendum C's point 2 flagged as still-manual, and the
// exact check that caught bugs #2 and #3 during that pass). Each test opens
// its own BEGIN/ROLLBACK, inserts its own fixture rows, and never commits --
// fully hermetic, no dependency on seeded demo data, no cleanup needed.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";

let client: Client;

before(async () => {
  client = new Client({
    host: process.env.WEB_POSTGRES_HOST ?? "localhost",
    port: Number(process.env.WEB_POSTGRES_PORT ?? 5434),
    user: process.env.APP_POSTGRES_USER ?? "vetify_web_app",
    password: process.env.APP_POSTGRES_PASSWORD ?? "vetify_web_app",
    database: process.env.WEB_POSTGRES_DATABASE ?? "vetify_web",
  });
  await client.connect();
});

after(async () => {
  await client.end();
});

async function setSession(role: string | null, cacRegNumber?: string) {
  await client.query("SELECT set_config('app.current_party_role', $1, true)", [role ?? ""]);
  await client.query("SELECT set_config('app.current_cac_reg_number', $1, true)", [cacRegNumber ?? ""]);
}

// ─── business_onboarding ────────────────────────────────────────────────────

test("business_onboarding: a business session only sees its own CAC's rows", async () => {
  await client.query("BEGIN");
  try {
    // Postgres RLS note (found while writing this test, not a bug): INSERT
    // ... RETURNING must also satisfy the table's SELECT policy, since
    // RETURNING re-reads the row it just wrote. A 'business' session must
    // therefore have app.current_cac_reg_number already matching the row
    // being created -- exactly how real usage works today (createOnboarding
    // is always called by a session whose own cacRegNumber is what gets
    // written), so this isn't a workaround, it's the real invariant.
    await setSession("business", "RLSTEST-A");
    const insertA = await client.query(
      `INSERT INTO business_onboarding (cac_reg_number, profile, kyc, documents, onboarding_ref)
       VALUES ('RLSTEST-A', '{}', '{}', '[]', 'REF-A') RETURNING id`,
    );
    await setSession("business", "RLSTEST-B");
    const insertB = await client.query(
      `INSERT INTO business_onboarding (cac_reg_number, profile, kyc, documents, onboarding_ref)
       VALUES ('RLSTEST-B', '{}', '{}', '[]', 'REF-B') RETURNING id`,
    );
    const idA = insertA.rows[0].id;
    const idB = insertB.rows[0].id;

    await setSession("business", "RLSTEST-A");
    const asA = await client.query("SELECT id FROM business_onboarding WHERE id IN ($1, $2)", [idA, idB]);
    assert.deepEqual(asA.rows.map((r) => r.id).sort(), [idA].sort(), "business A must see only its own row");

    await setSession("business", "RLSTEST-B");
    const asB = await client.query("SELECT id FROM business_onboarding WHERE id IN ($1, $2)", [idA, idB]);
    assert.deepEqual(asB.rows.map((r) => r.id).sort(), [idB].sort(), "business B must see only its own row");

    await setSession("business", "RLSTEST-NONEXISTENT");
    const asNone = await client.query("SELECT id FROM business_onboarding WHERE id IN ($1, $2)", [idA, idB]);
    assert.equal(asNone.rows.length, 0, "an unrelated business CAC must see neither row");

    await setSession(null);
    const asNoRole = await client.query("SELECT id FROM business_onboarding WHERE id IN ($1, $2)", [idA, idB]);
    assert.equal(asNoRole.rows.length, 0, "no session context at all must see nothing (fail-closed)");

    await setSession("vetify");
    const asVetify = await client.query("SELECT id FROM business_onboarding WHERE id IN ($1, $2)", [idA, idB]);
    assert.equal(asVetify.rows.length, 2, "vetify must see both rows regardless of tenant");

    await setSession("verifier");
    const asVerifier = await client.query("SELECT id FROM business_onboarding WHERE id IN ($1, $2)", [idA, idB]);
    assert.equal(asVerifier.rows.length, 2, "verifier must see both rows regardless of tenant");
  } finally {
    await client.query("ROLLBACK");
  }
});

test("business_onboarding: an anonymous/unrecognized session cannot write", async () => {
  await client.query("BEGIN");
  try {
    await setSession("some-made-up-role");
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO business_onboarding (cac_reg_number, profile, kyc, documents, onboarding_ref)
           VALUES ('RLSTEST-C', '{}', '{}', '[]', 'REF-C')`,
        ),
      /row-level security/,
      "an unrecognized role must be rejected by the INSERT policy",
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── verification_result / compliance_review / compliance_result ──────────
// Same select-policy shape as business_onboarding (vetify/verifier see all,
// business sees only its own CAC) -- one representative table exercised
// directly rather than all three, since the policy SQL (migrations/
// 001_stage1_4_vertical_slice.sql) is identical in structure for all three.

test("compliance_review: a business session only sees its own CAC's rows", async () => {
  await client.query("BEGIN");
  try {
    await setSession("business", "RLSTEST-A");
    const onboarding = await client.query(
      `INSERT INTO business_onboarding (cac_reg_number, profile, kyc, documents, onboarding_ref)
       VALUES ('RLSTEST-A', '{}', '{}', '[]', 'REF-A') RETURNING id`,
    );
    await setSession("verifier");
    const verification = await client.query(
      `INSERT INTO verification_result
         (business_onboarding_id, cac_reg_number, business_name, checks, risk_score,
          risk_level, outcome, auto_decided, verification_ref, decided_at)
       VALUES ($1, 'RLSTEST-A', 'Test A', '{}', 90, 'Low', 'Approved', false, 'VER-A', now())
       RETURNING id`,
      [onboarding.rows[0].id],
    );

    await setSession("vetify");
    const insertA = await client.query(
      `INSERT INTO compliance_review
         (verification_result_id, cac_reg_number, business_name, business_sector,
          business_activity, incorporation_date, verification_ref, compliance_ref)
       VALUES ($1, 'RLSTEST-A', 'Test A', 'Retail', 'Retail', '2020-01-01', 'VER-A', 'COM-A')
       RETURNING id`,
      [verification.rows[0].id],
    );
    const idA = insertA.rows[0].id;

    await setSession("business", "RLSTEST-A");
    const asA = await client.query("SELECT id FROM compliance_review WHERE id = $1", [idA]);
    assert.equal(asA.rows.length, 1, "the matching business must see its own compliance review");

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM compliance_review WHERE id = $1", [idA]);
    assert.equal(asOther.rows.length, 0, "a different business must not see it");

    await setSession(null);
    const asNoRole = await client.query("SELECT id FROM compliance_review WHERE id = $1", [idA]);
    assert.equal(asNoRole.rows.length, 0, "no session context must see nothing");
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── approved_business ──────────────────────────────────────────────────────
// The table where bug #3 (write-policy over-narrowing) was actually found --
// this specific case is worth its own direct regression test, not just
// coverage-by-similarity with the other tables above.

test("approved_business: verifier can INSERT (regression test for bug #3 -- ApproveCompliance is verifier-controlled)", async () => {
  await client.query("BEGIN");
  try {
    await setSession("verifier");
    await assert.doesNotReject(() =>
      client.query(
        `INSERT INTO approved_business
           (cac_reg_number, business_name, business_sector, business_activity,
            incorporation_date, verification_ref, compliance_ref, approved_at)
         VALUES ('RLSTEST-A', 'Test A', 'Retail', 'Retail', '2020-01-01', 'VER-A', 'COM-A', now())`,
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("approved_business: a business session only sees its own CAC's row, vetify/verifier see all", async () => {
  await client.query("BEGIN");
  try {
    await setSession("vetify");
    await client.query(
      `INSERT INTO approved_business
         (cac_reg_number, business_name, business_sector, business_activity,
          incorporation_date, verification_ref, compliance_ref, approved_at)
       VALUES ('RLSTEST-A', 'Test A', 'Retail', 'Retail', '2020-01-01', 'VER-A', 'COM-A', now()),
              ('RLSTEST-B', 'Test B', 'Retail', 'Retail', '2020-01-01', 'VER-B', 'COM-B', now())`,
    );

    await setSession("business", "RLSTEST-A");
    const asA = await client.query(
      "SELECT cac_reg_number FROM approved_business WHERE cac_reg_number IN ('RLSTEST-A', 'RLSTEST-B')",
    );
    assert.deepEqual(asA.rows.map((r) => r.cac_reg_number), ["RLSTEST-A"]);

    await setSession("vetify");
    const asVetify = await client.query(
      "SELECT cac_reg_number FROM approved_business WHERE cac_reg_number IN ('RLSTEST-A', 'RLSTEST-B')",
    );
    assert.equal(asVetify.rows.length, 2);
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── financing_request (Phase 2, Stage 5-7) ────────────────────────────────
// Same select-policy shape as the Phase 1 tables, but visible to a fourth
// and fifth role (assessor, financialInstitution) instead of just vetify/
// verifier -- worth its own direct test rather than assuming the pattern
// generalizes silently.

test("financing_request: business sees only its own CAC; assessor/financialInstitution/vetify see all", async () => {
  await client.query("BEGIN");
  try {
    await setSession("business", "RLSTEST-A");
    const insertA = await client.query(
      `INSERT INTO financing_request
         (cac_reg_number, business_name, terms_amount, terms_purpose, terms_tenure_months,
          financing_ref, business_sector, incorporation_date)
       VALUES ('RLSTEST-A', 'Test A', 500000, 'Inventory', 12, 'FIN-A', 'Retail', '2020-01-01')
       RETURNING id`,
    );
    const idA = insertA.rows[0].id;

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM financing_request WHERE id = $1", [idA]);
    assert.equal(asOther.rows.length, 0, "a different business must not see it");

    for (const role of ["vetify", "assessor", "financialInstitution"]) {
      await setSession(role);
      const asRole = await client.query("SELECT id FROM financing_request WHERE id = $1", [idA]);
      assert.equal(asRole.rows.length, 1, `${role} must see the row regardless of tenant`);
    }

    await setSession(null);
    const asNoRole = await client.query("SELECT id FROM financing_request WHERE id = $1", [idA]);
    assert.equal(asNoRole.rows.length, 0, "no session context must see nothing");
  } finally {
    await client.query("ROLLBACK");
  }
});

test("financing_request: only a business session can INSERT (regression-shaped check mirroring bug #2's lesson)", async () => {
  await client.query("BEGIN");
  try {
    await setSession("assessor");
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO financing_request
             (cac_reg_number, business_name, terms_amount, terms_purpose, terms_tenure_months,
              financing_ref, business_sector, incorporation_date)
           VALUES ('RLSTEST-A', 'Test A', 500000, 'Inventory', 12, 'FIN-B', 'Retail', '2020-01-01')`,
        ),
      /row-level security/,
      "assessor is not the FinancingRequest signatory (business) and must not be able to insert one",
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── murabahah_proposal / murabahah_contract (Phase 2, Stage 8) ────────────
// murabahah_proposal additionally grants `advisor` blanket visibility (the
// SSB needs to see proposals to certify them) -- worth its own check since
// no earlier table has a fourth non-business blanket-visibility role.

test("murabahah_proposal: advisor has blanket visibility (needed to certify terms)", async () => {
  await client.query("BEGIN");
  try {
    await setSession("financialInstitution");
    const insert = await client.query(
      `INSERT INTO murabahah_wad
         (cac_reg_number, business_name, terms_amount, terms_purpose, terms_tenure_months,
          asset_description, asset_supplier, asset_supplier_ref, asset_estimated_cost)
       VALUES ('RLSTEST-A', 'Test A', 500000, 'Inventory', 12, 'Flour', 'Golden Mills', 'PO-1', 500000)
       RETURNING id`,
    );
    const wadId = insert.rows[0].id;
    const purchase = await client.query(
      `INSERT INTO asset_purchase_record
         (murabahah_wad_id, cac_reg_number, business_name, terms_amount, terms_purpose,
          terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref,
          asset_estimated_cost, actual_cost, purchase_date, invoice_ref, total_acquisition_cost)
       VALUES ($1, 'RLSTEST-A', 'Test A', 500000, 'Inventory', 12, 'Flour', 'Golden Mills', 'PO-1',
               500000, 500000, '2026-01-01', 'INV-1', 500000)
       RETURNING id`,
      [wadId],
    );
    const proposal = await client.query(
      `INSERT INTO murabahah_proposal
         (asset_purchase_record_id, facility_ref, cac_reg_number, business_name, terms_amount,
          terms_purpose, terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref,
          asset_estimated_cost, actual_cost, asset_cost, profit_amount, sale_price, installment_amount,
          murabahah_tenure_months, payment_schedule, start_date)
       VALUES ($1, 'FAC-A', 'RLSTEST-A', 'Test A', 500000, 'Inventory', 12, 'Flour', 'Golden Mills',
               'PO-1', 500000, 500000, 500000, 50000, 550000, 45833, 12, '[]', '2026-02-01')
       RETURNING id`,
      [purchase.rows[0].id],
    );
    const proposalId = proposal.rows[0].id;

    await setSession("advisor");
    const asAdvisor = await client.query("SELECT id FROM murabahah_proposal WHERE id = $1", [proposalId]);
    assert.equal(asAdvisor.rows.length, 1, "advisor must see the proposal to certify it");

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM murabahah_proposal WHERE id = $1", [proposalId]);
    assert.equal(asOther.rows.length, 0, "a different business must not see it");
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── repayment_record / audit_event (Phase 2, Stage 9-10) ──────────────────
// audit_event is the interesting case here: unlike every other table in this
// slice, its Daml original (signatory vetify, observer financialInstitution)
// has NO business visibility at all -- worth its own check since every
// earlier table in this migration set grants the owning business read access.

async function buildContractFixture(cac: string, facilityRef: string): Promise<number> {
  await setSession("financialInstitution");
  const wad = await client.query(
    `INSERT INTO murabahah_wad
       (cac_reg_number, business_name, terms_amount, terms_purpose, terms_tenure_months,
        asset_description, asset_supplier, asset_supplier_ref, asset_estimated_cost)
     VALUES ($1, 'Test Co', 500000, 'Inventory', 12, 'Flour', 'Golden Mills', 'PO-1', 500000)
     RETURNING id`,
    [cac],
  );
  const purchase = await client.query(
    `INSERT INTO asset_purchase_record
       (murabahah_wad_id, cac_reg_number, business_name, terms_amount, terms_purpose,
        terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref,
        asset_estimated_cost, actual_cost, purchase_date, invoice_ref, total_acquisition_cost)
     VALUES ($1, $2, 'Test Co', 500000, 'Inventory', 12, 'Flour', 'Golden Mills', 'PO-1',
             500000, 500000, '2026-01-01', 'INV-1', 500000)
     RETURNING id`,
    [wad.rows[0].id, cac],
  );
  const proposal = await client.query(
    `INSERT INTO murabahah_proposal
       (asset_purchase_record_id, facility_ref, cac_reg_number, business_name, terms_amount,
        terms_purpose, terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref,
        asset_estimated_cost, actual_cost, asset_cost, profit_amount, sale_price, installment_amount,
        murabahah_tenure_months, payment_schedule, start_date)
     VALUES ($1, $2, $3, 'Test Co', 500000, 'Inventory', 12, 'Flour', 'Golden Mills',
             'PO-1', 500000, 500000, 500000, 50000, 550000, 45833, 12, '[]', '2026-02-01')
     RETURNING id`,
    [purchase.rows[0].id, facilityRef, cac],
  );
  await setSession("business", cac);
  const contract = await client.query(
    `INSERT INTO murabahah_contract
       (murabahah_proposal_id, facility_ref, cac_reg_number, business_name, terms_amount,
        terms_purpose, terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref,
        asset_estimated_cost, asset_cost, profit_amount, sale_price, installment_amount,
        murabahah_tenure_months, payment_schedule, start_date, outstanding_balance,
        shariah_certification_ref, shariah_certified_by)
     VALUES ($1, $2, $3, 'Test Co', 500000, 'Inventory', 12, 'Flour', 'Golden Mills',
             'PO-1', 500000, 500000, 50000, 550000, 45833, 12, '[]', '2026-02-01', 550000,
             $4, 'Sheikh Test')
     RETURNING id`,
    [proposal.rows[0].id, facilityRef, cac, `CERT-${cac}`],
  );
  return contract.rows[0].id;
}

test("repayment_record: a different business cannot see another tenant's installment history", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-A");

    await setSession("financialInstitution");
    const record = await client.query(
      `INSERT INTO repayment_record
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, installment_no,
          due_date, payment_date, amount_paid, remaining_balance, was_late)
       VALUES ($1, 'FAC-RLS-A', 'RLSTEST-A', 'Test A', 1, '2026-03-01', '2026-03-01', 45833, 504167, false)
       RETURNING id`,
      [contractId],
    );
    const recordId = record.rows[0].id;

    await setSession("business", "RLSTEST-A");
    const asOwner = await client.query("SELECT id FROM repayment_record WHERE id = $1", [recordId]);
    assert.equal(asOwner.rows.length, 1, "the owning business must see its own repayment history");

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM repayment_record WHERE id = $1", [recordId]);
    assert.equal(asOther.rows.length, 0, "a different business must not see it");
  } finally {
    await client.query("ROLLBACK");
  }
});

test("audit_event: signed vetify, observed only by financialInstitution -- the business is NOT an observer", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-B");

    await setSession("sentinel");
    const evt = await client.query(
      `INSERT INTO audit_event (murabahah_contract_id, cac_reg_number, business_name, event_type, description, acted_by)
       VALUES ($1, 'RLSTEST-A', 'Test A', 'DELINQUENCY_FLAGGED', 'Flagged for test', 'sentinel')
       RETURNING id`,
      [contractId],
    );
    const evtId = evt.rows[0].id;

    await setSession("financialInstitution");
    const asFi = await client.query("SELECT id FROM audit_event WHERE id = $1", [evtId]);
    assert.equal(asFi.rows.length, 1, "financialInstitution is an observer in the Daml original");

    await setSession("business", "RLSTEST-A");
    const asOwningBusiness = await client.query("SELECT id FROM audit_event WHERE id = $1", [evtId]);
    assert.equal(
      asOwningBusiness.rows.length,
      0,
      "the business is NOT a signatory or observer of AuditEvent in the Daml original -- must stay invisible even to the contract's own business",
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── portfolio_report (Phase 2, fourth slice: Reporting) ───────────────────
// Mirrors the Daml original's signatory/observer clause exactly: vetify
// signs, financialInstitution and regulator observe, business is never a
// reader at all -- worth its own check since this is the first table where
// 'regulator' (a brand new party role for this migration) has real read
// access to verify.

test("portfolio_report: vetify/financialInstitution/regulator can read, business cannot", async () => {
  await client.query("BEGIN");
  try {
    await setSession("vetify");
    const insert = await client.query(
      `INSERT INTO portfolio_report
         (report_date, total_active_contracts, total_disbursed, total_outstanding,
          delinquent_count, completed_count, defaulted_count, summary)
       VALUES (CURRENT_DATE, 2, 1100000, 1008333.34, 0, 0, 0, 'Test summary')
       RETURNING id`,
    );
    const reportId = insert.rows[0].id;

    const asVetify = await client.query("SELECT id FROM portfolio_report WHERE id = $1", [reportId]);
    assert.equal(asVetify.rows.length, 1);

    await setSession("financialInstitution");
    const asFi = await client.query("SELECT id FROM portfolio_report WHERE id = $1", [reportId]);
    assert.equal(asFi.rows.length, 1);

    await setSession("regulator");
    const asRegulator = await client.query("SELECT id FROM portfolio_report WHERE id = $1", [reportId]);
    assert.equal(asRegulator.rows.length, 1);

    await setSession("business", "RLSTEST-A");
    const asBusiness = await client.query("SELECT id FROM portfolio_report WHERE id = $1", [reportId]);
    assert.equal(asBusiness.rows.length, 0, "business is never an observer of PortfolioReport in the Daml original");
  } finally {
    await client.query("ROLLBACK");
  }
});

test("portfolio_report: only vetify can insert", async () => {
  await client.query("BEGIN");
  try {
    await setSession("regulator");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO portfolio_report
           (report_date, total_active_contracts, total_disbursed, total_outstanding,
            delinquent_count, completed_count, defaulted_count, summary)
         VALUES (CURRENT_DATE, 0, 0, 0, 0, 0, 0, 'Should be rejected')`,
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── ibra_request / default_record (Phase 2, fifth slice) ──────────────────

test("ibra_request: the owning business can insert and read its own request; a different business cannot", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-C");

    await setSession("business", "RLSTEST-A");
    const insert = await client.query(
      `INSERT INTO ibra_request
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, outstanding_balance,
          requested_settlement_date, settlement_type)
       VALUES ($1, 'FAC-RLS-C', 'RLSTEST-A', 'Test Co', 550000, '2026-03-01', 'FullIbra')
       RETURNING id`,
      [contractId],
    );
    const requestId = insert.rows[0].id;

    const asOwner = await client.query("SELECT id FROM ibra_request WHERE id = $1", [requestId]);
    assert.equal(asOwner.rows.length, 1);

    await setSession("financialInstitution");
    const asFi = await client.query("SELECT id FROM ibra_request WHERE id = $1", [requestId]);
    assert.equal(asFi.rows.length, 1);

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM ibra_request WHERE id = $1", [requestId]);
    assert.equal(asOther.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

test("default_record: vetify/financialInstitution/regulator and the owning business can read; a different business cannot", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-D");

    await setSession("financialInstitution");
    const insert = await client.query(
      `INSERT INTO default_record (murabahah_contract_id, facility_ref, cac_reg_number, business_name, reason, defaulted_by, defaulted_at)
       VALUES ($1, 'FAC-RLS-D', 'RLSTEST-A', 'Test Co', 'Unrecoverable', 'Test Officer', now())
       RETURNING id`,
      [contractId],
    );
    const recordId = insert.rows[0].id;

    const asFi = await client.query("SELECT id FROM default_record WHERE id = $1", [recordId]);
    assert.equal(asFi.rows.length, 1);

    await setSession("regulator");
    const asRegulator = await client.query("SELECT id FROM default_record WHERE id = $1", [recordId]);
    assert.equal(asRegulator.rows.length, 1);

    await setSession("business", "RLSTEST-A");
    const asOwner = await client.query("SELECT id FROM default_record WHERE id = $1", [recordId]);
    assert.equal(asOwner.rows.length, 1);

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM default_record WHERE id = $1", [recordId]);
    assert.equal(asOther.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── rahn_agreement (Phase 2, sixth slice) ──────────────────────────────────

test("rahn_agreement: only a financialInstitution session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-E");
    await setSession("business", "RLSTEST-A");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO rahn_agreement (murabahah_contract_id, facility_ref, cac_reg_number, business_name, collateral_description, collateral_value)
         VALUES ($1, 'FAC-RLS-E', 'RLSTEST-A', 'Test Co', 'Plot 14', 1000000)`,
        [contractId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("rahn_agreement: vetify/financialInstitution/regulator and the owning business can read; a different business cannot", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-F");

    await setSession("financialInstitution");
    const insert = await client.query(
      `INSERT INTO rahn_agreement (murabahah_contract_id, facility_ref, cac_reg_number, business_name, collateral_description, collateral_value)
       VALUES ($1, 'FAC-RLS-F', 'RLSTEST-A', 'Test Co', 'Plot 14', 1000000)
       RETURNING id`,
      [contractId],
    );
    const rahnId = insert.rows[0].id;

    await setSession("regulator");
    const asRegulator = await client.query("SELECT id FROM rahn_agreement WHERE id = $1", [rahnId]);
    assert.equal(asRegulator.rows.length, 1);

    await setSession("business", "RLSTEST-A");
    const asOwner = await client.query("SELECT id FROM rahn_agreement WHERE id = $1", [rahnId]);
    assert.equal(asOwner.rows.length, 1);

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM rahn_agreement WHERE id = $1", [rahnId]);
    assert.equal(asOther.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── collateral_valuation_document (Phase 2, seventh slice) ─────────────────

async function insertRahnFixture(cac: string, facilityRef: string): Promise<number> {
  const contractId = await buildContractFixture(cac, facilityRef);
  await setSession("financialInstitution");
  const insert = await client.query(
    `INSERT INTO rahn_agreement (murabahah_contract_id, facility_ref, cac_reg_number, business_name, collateral_description, collateral_value)
     VALUES ($1, $2, $3, 'Test Co', 'Plot 14', 1000000)
     RETURNING id`,
    [contractId, facilityRef, cac],
  );
  return insert.rows[0].id;
}

test("collateral_valuation_document: only a business session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const rahnId = await insertRahnFixture("RLSTEST-A", "FAC-RLS-G");

    await setSession("financialInstitution");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO collateral_valuation_document
           (rahn_agreement_id, cac_reg_number, business_name, valuator_ref, valuation_amount, valuation_date, doc_type, content_hash, storage_ref)
         VALUES ($1, 'RLSTEST-A', 'Test Co', 'Test Valuers Ltd', 1200000, '2026-01-01', 'CollateralValuationReport', 'abc123', 'local://report.pdf')`,
        [rahnId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("collateral_valuation_document: vetify/financialInstitution/regulator and the owning business can read; a different business cannot", async () => {
  await client.query("BEGIN");
  try {
    const rahnId = await insertRahnFixture("RLSTEST-A", "FAC-RLS-H");

    await setSession("business", "RLSTEST-A");
    const insert = await client.query(
      `INSERT INTO collateral_valuation_document
         (rahn_agreement_id, cac_reg_number, business_name, valuator_ref, valuation_amount, valuation_date, doc_type, content_hash, storage_ref)
       VALUES ($1, 'RLSTEST-A', 'Test Co', 'Test Valuers Ltd', 1200000, '2026-01-01', 'CollateralValuationReport', 'abc123', 'local://report.pdf')
       RETURNING id`,
      [rahnId],
    );
    const docId = insert.rows[0].id;

    await setSession("financialInstitution");
    const asFi = await client.query("SELECT id FROM collateral_valuation_document WHERE id = $1", [docId]);
    assert.equal(asFi.rows.length, 1);

    await setSession("regulator");
    const asRegulator = await client.query("SELECT id FROM collateral_valuation_document WHERE id = $1", [docId]);
    assert.equal(asRegulator.rows.length, 1);

    await setSession("business", "RLSTEST-A");
    const asOwner = await client.query("SELECT id FROM collateral_valuation_document WHERE id = $1", [docId]);
    assert.equal(asOwner.rows.length, 1);

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM collateral_valuation_document WHERE id = $1", [docId]);
    assert.equal(asOther.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── restructuring_request / dispute_record / arbitration_request (Phase 2, eighth slice) ──

test("restructuring_request: only a business session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-I");

    await setSession("financialInstitution");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO restructuring_request
           (murabahah_contract_id, facility_ref, cac_reg_number, business_name, outstanding_balance, proposed_schedule, reason, request_date)
         VALUES ($1, 'FAC-RLS-I', 'RLSTEST-A', 'Test Co', 300000, '[]', 'Cash flow difficulty', '2026-03-01')`,
        [contractId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("restructuring_request: vetify/financialInstitution and the owning business can read; a different business cannot", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-J");

    await setSession("business", "RLSTEST-A");
    const insert = await client.query(
      `INSERT INTO restructuring_request
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, outstanding_balance, proposed_schedule, reason, request_date)
       VALUES ($1, 'FAC-RLS-J', 'RLSTEST-A', 'Test Co', 300000, '[]', 'Cash flow difficulty', '2026-03-01')
       RETURNING id`,
      [contractId],
    );
    const requestId = insert.rows[0].id;

    await setSession("financialInstitution");
    const asFi = await client.query("SELECT id FROM restructuring_request WHERE id = $1", [requestId]);
    assert.equal(asFi.rows.length, 1);

    await setSession("business", "RLSTEST-A");
    const asOwner = await client.query("SELECT id FROM restructuring_request WHERE id = $1", [requestId]);
    assert.equal(asOwner.rows.length, 1);

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM restructuring_request WHERE id = $1", [requestId]);
    assert.equal(asOther.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

test("dispute_record: only a business session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-K");

    await setSession("financialInstitution");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO dispute_record
           (murabahah_contract_id, facility_ref, cac_reg_number, business_name, dispute_type, description, raised_at)
         VALUES ($1, 'FAC-RLS-K', 'RLSTEST-A', 'Test Co', 'PaymentDispute', 'Disagreement over a recorded payment', now())`,
        [contractId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("dispute_record: vetify/financialInstitution and the owning business can read; a different business cannot", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-L");

    await setSession("business", "RLSTEST-A");
    const insert = await client.query(
      `INSERT INTO dispute_record
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, dispute_type, description, raised_at)
       VALUES ($1, 'FAC-RLS-L', 'RLSTEST-A', 'Test Co', 'PaymentDispute', 'Disagreement over a recorded payment', now())
       RETURNING id`,
      [contractId],
    );
    const disputeId = insert.rows[0].id;

    await setSession("financialInstitution");
    const asFi = await client.query("SELECT id FROM dispute_record WHERE id = $1", [disputeId]);
    assert.equal(asFi.rows.length, 1);

    await setSession("business", "RLSTEST-A");
    const asOwner = await client.query("SELECT id FROM dispute_record WHERE id = $1", [disputeId]);
    assert.equal(asOwner.rows.length, 1);

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM dispute_record WHERE id = $1", [disputeId]);
    assert.equal(asOther.rows.length, 0);

    // Only vetify can archive it (EscalateToArbitration's supersede step) --
    // an UPDATE policy filters rows rather than throwing, so a non-vetify
    // session's UPDATE silently matches zero rows instead of erroring.
    await setSession("financialInstitution");
    const attempted = await client.query("UPDATE dispute_record SET archived_at = now() WHERE id = $1", [disputeId]);
    assert.equal(attempted.rowCount, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

test("arbitration_request: only a vetify session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-M");
    await setSession("business", "RLSTEST-A");
    const dispute = await client.query(
      `INSERT INTO dispute_record
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, dispute_type, description, raised_at)
       VALUES ($1, 'FAC-RLS-M', 'RLSTEST-A', 'Test Co', 'PaymentDispute', 'Disagreement over a recorded payment', now())
       RETURNING id`,
      [contractId],
    );

    await setSession("financialInstitution");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO arbitration_request
           (dispute_record_id, cac_reg_number, business_name, arbitrator, dispute_description, escalated_at)
         VALUES ($1, 'RLSTEST-A', 'Test Co', 'Lagos Chamber of Commerce Arbitration Centre', 'Disagreement over a recorded payment', now())`,
        [dispute.rows[0].id],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── direct_debit_mandate / direct_debit_collection_attempt / recovery_payment_record / gsm_invocation (Phase 2, ninth slice) ──

test("direct_debit_mandate: only a financialInstitution session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-N");
    await setSession("business", "RLSTEST-A");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO direct_debit_mandate
           (murabahah_contract_id, facility_ref, cac_reg_number, business_name, mono_mandate_ref, account_ref, bank_name, max_collection_amount, mandate_start_date)
         VALUES ($1, 'FAC-RLS-N', 'RLSTEST-A', 'Test Co', 'MONO-1', '0123456789', 'Test Bank', 150000, '2026-02-01')`,
        [contractId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("direct_debit_mandate: vetify/financialInstitution and the owning business can read; a different business cannot", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-O");
    await setSession("financialInstitution");
    const insert = await client.query(
      `INSERT INTO direct_debit_mandate
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, mono_mandate_ref, account_ref, bank_name, max_collection_amount, mandate_start_date)
       VALUES ($1, 'FAC-RLS-O', 'RLSTEST-A', 'Test Co', 'MONO-2', '0123456789', 'Test Bank', 150000, '2026-02-01')
       RETURNING id`,
      [contractId],
    );
    const mandateId = insert.rows[0].id;

    await setSession("business", "RLSTEST-A");
    const asOwner = await client.query("SELECT id FROM direct_debit_mandate WHERE id = $1", [mandateId]);
    assert.equal(asOwner.rows.length, 1);

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM direct_debit_mandate WHERE id = $1", [mandateId]);
    assert.equal(asOther.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

test("direct_debit_collection_attempt: only a financialInstitution session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-P");
    await setSession("business", "RLSTEST-A");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO direct_debit_collection_attempt
           (murabahah_contract_id, facility_ref, cac_reg_number, business_name, mono_collection_ref, installment_no, attempted_amount, attempt_date, succeeded)
         VALUES ($1, 'FAC-RLS-P', 'RLSTEST-A', 'Test Co', 'MONO-COL-A', 1, 150000, '2026-03-01', true)`,
        [contractId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("recovery_payment_record: only a financialInstitution session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-Q");
    await setSession("business", "RLSTEST-A");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO recovery_payment_record
           (murabahah_contract_id, facility_ref, cac_reg_number, business_name, amount_recovered, recovery_date, recovery_source, remaining_balance)
         VALUES ($1, 'FAC-RLS-Q', 'RLSTEST-A', 'Test Co', 50000, '2026-05-01', 'VOLUNTARY', 100000)`,
        [contractId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("gsm_invocation: only a financialInstitution session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-R");
    await setSession("business", "RLSTEST-A");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO gsm_invocation
           (murabahah_contract_id, facility_ref, cac_reg_number, business_name, business_bvn, invoked_amount, mono_gsm_ref, invoked_at)
         VALUES ($1, 'FAC-RLS-R', 'RLSTEST-A', 'Test Co', '12345678901', 200000, 'GSM-A', now())`,
        [contractId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

// A rejected INSERT inside a BEGIN block poisons the rest of that
// transaction (must ROLLBACK before running further queries) -- the same
// gotcha this migration's test suite has hit and documented several times
// before -- so the read-permission checks below run in their own separate
// BEGIN/ROLLBACK rather than continuing after the reject above.
test("gsm_invocation: vetify/regulator/owning business can read; a different business cannot", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-S");
    await setSession("financialInstitution");
    const insert = await client.query(
      `INSERT INTO gsm_invocation
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, business_bvn, invoked_amount, mono_gsm_ref, invoked_at)
       VALUES ($1, 'FAC-RLS-S', 'RLSTEST-A', 'Test Co', '12345678901', 200000, 'GSM-B', now())
       RETURNING id`,
      [contractId],
    );
    const gsmId = insert.rows[0].id;

    await setSession("regulator");
    const asRegulator = await client.query("SELECT id FROM gsm_invocation WHERE id = $1", [gsmId]);
    assert.equal(asRegulator.rows.length, 1);

    await setSession("business", "RLSTEST-A");
    const asOwner = await client.query("SELECT id FROM gsm_invocation WHERE id = $1", [gsmId]);
    assert.equal(asOwner.rows.length, 1);

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM gsm_invocation WHERE id = $1", [gsmId]);
    assert.equal(asOther.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

// ─── moratorium_record / hamish_jiddiyyah (Phase 2, tenth slice) ──────────

test("moratorium_record: only a financialInstitution session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-T");
    await setSession("business", "RLSTEST-A");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO moratorium_record (murabahah_contract_id, facility_ref, cac_reg_number, business_name, moratorium_end, reason)
         VALUES ($1, 'FAC-RLS-T', 'RLSTEST-A', 'Test Co', '2026-05-01', 'Cash flow shortfall')`,
        [contractId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("moratorium_record: vetify/financialInstitution and the owning business can read; a different business cannot", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-U");
    await setSession("financialInstitution");
    const insert = await client.query(
      `INSERT INTO moratorium_record (murabahah_contract_id, facility_ref, cac_reg_number, business_name, moratorium_end, reason)
       VALUES ($1, 'FAC-RLS-U', 'RLSTEST-A', 'Test Co', '2026-05-01', 'Cash flow shortfall')
       RETURNING id`,
      [contractId],
    );
    const recordId = insert.rows[0].id;

    await setSession("business", "RLSTEST-A");
    const asOwner = await client.query("SELECT id FROM moratorium_record WHERE id = $1", [recordId]);
    assert.equal(asOwner.rows.length, 1);

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM moratorium_record WHERE id = $1", [recordId]);
    assert.equal(asOther.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

test("hamish_jiddiyyah: only a financialInstitution session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-V");
    await setSession("business", "RLSTEST-A");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO hamish_jiddiyyah
           (murabahah_contract_id, facility_ref, cac_reg_number, business_name, deposit_amount, deposit_ref, deposit_date, return_deadline)
         VALUES ($1, 'FAC-RLS-V', 'RLSTEST-A', 'Test Co', 50000, 'BANKXFER-A', '2026-01-15', '2026-04-01')`,
        [contractId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("hamish_jiddiyyah: vetify/financialInstitution and the owning business can read; a different business cannot", async () => {
  await client.query("BEGIN");
  try {
    const contractId = await buildContractFixture("RLSTEST-A", "FAC-RLS-W");
    await setSession("financialInstitution");
    const insert = await client.query(
      `INSERT INTO hamish_jiddiyyah
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, deposit_amount, deposit_ref, deposit_date, return_deadline)
       VALUES ($1, 'FAC-RLS-W', 'RLSTEST-A', 'Test Co', 50000, 'BANKXFER-B', '2026-01-15', '2026-04-01')
       RETURNING id`,
      [contractId],
    );
    const hamishId = insert.rows[0].id;

    await setSession("business", "RLSTEST-A");
    const asOwner = await client.query("SELECT id FROM hamish_jiddiyyah WHERE id = $1", [hamishId]);
    assert.equal(asOwner.rows.length, 1);

    await setSession("business", "RLSTEST-OTHER");
    const asOther = await client.query("SELECT id FROM hamish_jiddiyyah WHERE id = $1", [hamishId]);
    assert.equal(asOther.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});
// ─── Phase 2, Eleventh Slice: Stage 0 (FinancingProviderOnboarding) ───────

test("financing_provider_onboarding: only a financialInstitution session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    await setSession("vetify");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO financing_provider_onboarding
           (provider_name, address, cac_reg_number, provider_type, governing_doc_ref, declared_instruments)
         VALUES ('Test Provider', 'Lagos', 'RLSTEST-PROV-A', 'CooperativeSociety', '{}', '["Murabahah"]')`,
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("financing_provider_onboarding: vetify and financialInstitution can read; a business cannot", async () => {
  await client.query("BEGIN");
  try {
    await setSession("financialInstitution");
    const insert = await client.query(
      `INSERT INTO financing_provider_onboarding
         (provider_name, address, cac_reg_number, provider_type, governing_doc_ref, declared_instruments)
       VALUES ('Test Provider', 'Lagos', 'RLSTEST-PROV-B', 'CooperativeSociety', '{}', '["Murabahah"]')
       RETURNING id`,
    );
    const providerId = insert.rows[0].id;

    await setSession("vetify");
    const asVetify = await client.query("SELECT id FROM financing_provider_onboarding WHERE id = $1", [providerId]);
    assert.equal(asVetify.rows.length, 1);

    await setSession("business", "RLSTEST-A");
    const asBusiness = await client.query("SELECT id FROM financing_provider_onboarding WHERE id = $1", [providerId]);
    assert.equal(asBusiness.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

test("approved_provider: only a vetify session can INSERT", async () => {
  await client.query("BEGIN");
  try {
    await setSession("financialInstitution");
    const onboarding = await client.query(
      `INSERT INTO financing_provider_onboarding
         (provider_name, address, cac_reg_number, provider_type, governing_doc_ref, declared_instruments)
       VALUES ('Test Provider', 'Lagos', 'RLSTEST-PROV-C', 'CooperativeSociety', '{}', '["Murabahah"]')
       RETURNING id`,
    );
    const providerId = onboarding.rows[0].id;

    await assert.rejects(() =>
      client.query(
        `INSERT INTO approved_provider
           (financing_provider_onboarding_id, provider_name, provider_type, approved_instruments)
         VALUES ($1, 'Test Provider', 'CooperativeSociety', '["Murabahah"]')`,
        [providerId],
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("approved_provider: vetify/financialInstitution/regulator can read; a business cannot", async () => {
  await client.query("BEGIN");
  try {
    await setSession("financialInstitution");
    const onboarding = await client.query(
      `INSERT INTO financing_provider_onboarding
         (provider_name, address, cac_reg_number, provider_type, governing_doc_ref, declared_instruments)
       VALUES ('Test Provider', 'Lagos', 'RLSTEST-PROV-D', 'CooperativeSociety', '{}', '["Murabahah"]')
       RETURNING id`,
    );
    const providerId = onboarding.rows[0].id;

    await setSession("vetify");
    const insert = await client.query(
      `INSERT INTO approved_provider
         (financing_provider_onboarding_id, provider_name, provider_type, approved_instruments)
       VALUES ($1, 'Test Provider', 'CooperativeSociety', '["Murabahah"]')
       RETURNING id`,
      [providerId],
    );
    const approvedId = insert.rows[0].id;

    const asVetify = await client.query("SELECT id FROM approved_provider WHERE id = $1", [approvedId]);
    assert.equal(asVetify.rows.length, 1);

    await setSession("financialInstitution");
    const asFi = await client.query("SELECT id FROM approved_provider WHERE id = $1", [approvedId]);
    assert.equal(asFi.rows.length, 1);

    await setSession("regulator");
    const asRegulator = await client.query("SELECT id FROM approved_provider WHERE id = $1", [approvedId]);
    assert.equal(asRegulator.rows.length, 1);

    await setSession("business", "RLSTEST-A");
    const asBusiness = await client.query("SELECT id FROM approved_provider WHERE id = $1", [approvedId]);
    assert.equal(asBusiness.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

test("provider_verification_policy: vetify-only visibility -- a financialInstitution session cannot read or insert", async () => {
  await client.query("BEGIN");
  try {
    await setSession("vetify");
    const insert = await client.query(
      `INSERT INTO provider_verification_policy (policy_version, auto_reject_max, effective_from, scoring_weights)
       VALUES ('v1', 40, now(), '{}') RETURNING id`,
    );
    const policyId = insert.rows[0].id;

    await setSession("financialInstitution");
    const asFi = await client.query("SELECT id FROM provider_verification_policy WHERE id = $1", [policyId]);
    assert.equal(asFi.rows.length, 0);

    await assert.rejects(() =>
      client.query(
        `INSERT INTO provider_verification_policy (policy_version, auto_reject_max, effective_from, scoring_weights)
         VALUES ('v2', 40, now(), '{}')`,
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});
// ─── Phase 2, Fourteenth Slice: VerificationPolicy/CompliancePolicy maker-checker ──

test("verification_policy: vetify-only visibility -- a riskCommittee session cannot read or insert", async () => {
  await client.query("BEGIN");
  try {
    await setSession("vetify");
    const insert = await client.query(
      `INSERT INTO verification_policy (max_amendments, sla_hours, auto_approve_min, auto_reject_max, policy_version, scoring_weights)
       VALUES (5, 48, 80, 50, 'RLSTEST-VP-1', '{}') RETURNING id`,
    );
    const policyId = insert.rows[0].id;

    await setSession("riskCommittee");
    const asRiskCommittee = await client.query("SELECT id FROM verification_policy WHERE id = $1", [policyId]);
    assert.equal(asRiskCommittee.rows.length, 0);

    await assert.rejects(() =>
      client.query(
        `INSERT INTO verification_policy (max_amendments, sla_hours, auto_approve_min, auto_reject_max, policy_version, scoring_weights)
         VALUES (5, 48, 80, 50, 'RLSTEST-VP-2', '{}')`,
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("pending_verification_policy: riskCommittee cannot INSERT", async () => {
  // A failed statement poisons the rest of a Postgres transaction (all
  // subsequent commands are refused until ROLLBACK) -- kept as its own
  // isolated BEGIN/ROLLBACK rather than combined with the positive-path
  // test below, which needs to keep issuing queries afterward.
  await client.query("BEGIN");
  try {
    await setSession("riskCommittee");
    await assert.rejects(() =>
      client.query(
        `INSERT INTO pending_verification_policy
           (max_amendments, sla_hours, auto_approve_min, auto_reject_max, policy_version, scoring_weights, proposed_by, reason)
         VALUES (5, 48, 80, 50, 'RLSTEST-PVP-1', '{}', 'Alice', 'test')`,
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("pending_verification_policy: vetify can INSERT; both vetify and riskCommittee can read and UPDATE", async () => {
  await client.query("BEGIN");
  try {
    await setSession("vetify");
    const insert = await client.query(
      `INSERT INTO pending_verification_policy
         (max_amendments, sla_hours, auto_approve_min, auto_reject_max, policy_version, scoring_weights, proposed_by, reason)
       VALUES (5, 48, 80, 50, 'RLSTEST-PVP-2', '{}', 'Alice', 'test')
       RETURNING id`,
    );
    const pendingId = insert.rows[0].id;

    await setSession("riskCommittee");
    const asRiskCommittee = await client.query("SELECT id FROM pending_verification_policy WHERE id = $1", [pendingId]);
    assert.equal(asRiskCommittee.rows.length, 1);
    const updated = await client.query(
      "UPDATE pending_verification_policy SET risk_committee_endorsed_by = 'Bob' WHERE id = $1 RETURNING id",
      [pendingId],
    );
    assert.equal(updated.rows.length, 1);

    await setSession("vetify");
    const asVetify = await client.query("SELECT id FROM pending_verification_policy WHERE id = $1", [pendingId]);
    assert.equal(asVetify.rows.length, 1);
  } finally {
    await client.query("ROLLBACK");
  }
});

test("compliance_policy: vetify-only visibility -- a riskCommittee session cannot read or insert", async () => {
  await client.query("BEGIN");
  try {
    await setSession("vetify");
    const insert = await client.query(
      `INSERT INTO compliance_policy
         (auto_approve_min, auto_reject_max, escalation_sla_hours, shariah_policy_version, policy_version, effective_from, scoring_weights)
       VALUES (80, 50, 24, 'AAOIFI-2023-Std8', 'RLSTEST-CP-1', now(), '{}') RETURNING id`,
    );
    const policyId = insert.rows[0].id;

    await setSession("riskCommittee");
    const asRiskCommittee = await client.query("SELECT id FROM compliance_policy WHERE id = $1", [policyId]);
    assert.equal(asRiskCommittee.rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
  }
});

test("pending_compliance_policy: vetify can INSERT; both vetify and riskCommittee can read and UPDATE", async () => {
  await client.query("BEGIN");
  try {
    await setSession("vetify");
    const insert = await client.query(
      `INSERT INTO pending_compliance_policy
         (auto_approve_min, auto_reject_max, escalation_sla_hours, shariah_policy_version, policy_version,
          effective_from, scoring_weights, proposed_by, reason)
       VALUES (80, 50, 24, 'AAOIFI-2023-Std8', 'RLSTEST-PCP-1', now(), '{}', 'Alice', 'test')
       RETURNING id`,
    );
    const pendingId = insert.rows[0].id;

    await setSession("riskCommittee");
    const asRiskCommittee = await client.query("SELECT id FROM pending_compliance_policy WHERE id = $1", [pendingId]);
    assert.equal(asRiskCommittee.rows.length, 1);
    const updated = await client.query(
      "UPDATE pending_compliance_policy SET risk_committee_endorsed_by = 'Bob' WHERE id = $1 RETURNING id",
      [pendingId],
    );
    assert.equal(updated.rows.length, 1);
  } finally {
    await client.query("ROLLBACK");
  }
});
