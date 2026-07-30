// Unit/integration tests for lib/domain/murabahah.ts's Twenty-Ninth Slice
// additions: the regulatory inspection workflow (RegulatoryInspectionRequest
// -> InspectionResponse -> InspectionRecord). Unlike most of this migration's
// fixtures, this cluster is not tied to a MurabahahContract at all -- vetify
// creates the request directly, mirroring MurabahahTests.daml's M-RI test.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import {
  createRegulatoryInspectionRequest,
  extendDeadline,
  respondToInspection,
  closeInspection,
} from "@/lib/domain/murabahah";

function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
}
function fiSession(): SessionContext {
  return { userId: 5, username: "test-fi", displayName: "Test FI", partyRole: "financialInstitution", cacRegNumber: null };
}
function businessSession(cacRegNumber: string): SessionContext {
  return { userId: 1, username: "test-business", displayName: "Test Business", partyRole: "business", cacRegNumber };
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

async function cleanup(inspectionRef: string) {
  await fixtureClient.query(
    `DELETE FROM inspection_record WHERE inspection_ref = $1`,
    [inspectionRef],
  );
  await fixtureClient.query(
    `DELETE FROM inspection_response WHERE inspection_ref = $1`,
    [inspectionRef],
  );
  await fixtureClient.query(`DELETE FROM regulatory_inspection_request WHERE inspection_ref = $1`, [inspectionRef]);
}

// ─── createRegulatoryInspectionRequest ─────────────────────────────────────

test("createRegulatoryInspectionRequest: business cannot create it (vetify only), rejects an empty inspectionRef", async () => {
  const ref = "TEST-INSP-0001";
  try {
    await assert.rejects(
      () =>
        createRegulatoryInspectionRequest(businessSession("RC7000001"), {
          cacRegNumber: "RC7000001", businessName: "Test Co", inspectionRef: ref,
          inspectionScope: "Portfolio review", responseDeadline: "2026-12-31",
        }),
      (err: unknown) => err instanceof Error && err.message.includes("not authorized"),
    );
    await assert.rejects(
      () =>
        createRegulatoryInspectionRequest(vetifySession(), {
          cacRegNumber: "RC7000001", businessName: "Test Co", inspectionRef: "",
          inspectionScope: "Portfolio review", responseDeadline: "2026-12-31",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Inspection reference must not be empty",
    );
  } finally {
    await cleanup(ref);
  }
});

test("createRegulatoryInspectionRequest: happy path creates a live request", async () => {
  const ref = "TEST-INSP-0002";
  try {
    const result = await createRegulatoryInspectionRequest(vetifySession(), {
      cacRegNumber: "RC7000002", businessName: "Adaeze Textiles", inspectionRef: ref,
      inspectionScope: "Murabahah portfolio review Q3 2026", responseDeadline: "2026-10-31",
    });
    assert.ok(result.regulatoryInspectionRequestId);

    const { rows } = await fixtureClient.query(
      "SELECT inspection_scope, archived_at FROM regulatory_inspection_request WHERE id = $1",
      [result.regulatoryInspectionRequestId],
    );
    assert.equal(rows[0].inspection_scope, "Murabahah portfolio review Q3 2026");
    assert.equal(rows[0].archived_at, null);
  } finally {
    await cleanup(ref);
  }
});

// ─── extendDeadline ─────────────────────────────────────────────────────────

test("extendDeadline: rejects a deadline that is not later than the current one, happy path extends it", async () => {
  const ref = "TEST-INSP-0003";
  try {
    const req = await createRegulatoryInspectionRequest(vetifySession(), {
      cacRegNumber: "RC7000003", businessName: "Test Co", inspectionRef: ref,
      inspectionScope: "Portfolio review", responseDeadline: "2026-10-31",
    });

    await assert.rejects(
      () => extendDeadline(vetifySession(), Number(req.regulatoryInspectionRequestId), { newDeadline: "2026-10-01" }),
      (err: unknown) => err instanceof DomainError && err.message === "New deadline must be later than current",
    );

    const result = await extendDeadline(vetifySession(), Number(req.regulatoryInspectionRequestId), { newDeadline: "2026-11-30" });
    assert.equal(Number(result.regulatoryInspectionRequestId), Number(req.regulatoryInspectionRequestId));

    const { rows } = await fixtureClient.query(
      "SELECT response_deadline FROM regulatory_inspection_request WHERE id = $1",
      [req.regulatoryInspectionRequestId],
    );
    const d: Date = rows[0].response_deadline;
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    assert.equal(localDate, "2026-11-30");
  } finally {
    await cleanup(ref);
  }
});

// ─── respondToInspection ────────────────────────────────────────────────────

test("respondToInspection: rejects an empty responseRef/respondedByName, happy path archives the request and creates a response", async () => {
  const ref = "TEST-INSP-0004";
  try {
    const req = await createRegulatoryInspectionRequest(vetifySession(), {
      cacRegNumber: "RC7000004", businessName: "Test Co", inspectionRef: ref,
      inspectionScope: "Portfolio review", responseDeadline: "2026-10-31",
    });

    await assert.rejects(
      () =>
        respondToInspection(fiSession(), Number(req.regulatoryInspectionRequestId), {
          responseRef: "", documents: [], respondedByName: "Someone", responseDate: "2026-10-01",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Response reference must not be empty",
    );
    await assert.rejects(
      () =>
        respondToInspection(fiSession(), Number(req.regulatoryInspectionRequestId), {
          responseRef: "FI-RESP-1", documents: [], respondedByName: "", responseDate: "2026-10-01",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Responded-by name must not be empty",
    );

    const result = await respondToInspection(fiSession(), Number(req.regulatoryInspectionRequestId), {
      responseRef: "FI-RESP-2026-0004",
      documents: ["PortfolioReport-Q3.pdf", "ShariahAudit.pdf"],
      respondedByName: "Aminu Garba, Head of Operations",
      responseDate: "2026-10-25",
    });
    assert.ok(result.inspectionResponseId);

    const { rows: reqRow } = await fixtureClient.query(
      "SELECT archived_at, superseded_by_kind, superseded_by_id FROM regulatory_inspection_request WHERE id = $1",
      [req.regulatoryInspectionRequestId],
    );
    assert.ok(reqRow[0].archived_at);
    assert.equal(reqRow[0].superseded_by_kind, "inspection_response");
    assert.equal(Number(reqRow[0].superseded_by_id), Number(result.inspectionResponseId));

    const { rows: respRow } = await fixtureClient.query(
      "SELECT response_ref, documents FROM inspection_response WHERE id = $1",
      [result.inspectionResponseId],
    );
    assert.equal(respRow[0].response_ref, "FI-RESP-2026-0004");
    assert.equal(respRow[0].documents.length, 2);
  } finally {
    await cleanup(ref);
  }
});

test("respondToInspection: cannot respond to an already-archived request", async () => {
  const ref = "TEST-INSP-0005";
  try {
    const req = await createRegulatoryInspectionRequest(vetifySession(), {
      cacRegNumber: "RC7000005", businessName: "Test Co", inspectionRef: ref,
      inspectionScope: "Portfolio review", responseDeadline: "2026-10-31",
    });
    await respondToInspection(fiSession(), Number(req.regulatoryInspectionRequestId), {
      responseRef: "FI-RESP-1", documents: [], respondedByName: "Officer A", responseDate: "2026-10-01",
    });

    await assert.rejects(
      () =>
        respondToInspection(fiSession(), Number(req.regulatoryInspectionRequestId), {
          responseRef: "FI-RESP-2", documents: [], respondedByName: "Officer B", responseDate: "2026-10-02",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "RegulatoryInspectionRequest is no longer active",
    );
  } finally {
    await cleanup(ref);
  }
});

// ─── closeInspection ────────────────────────────────────────────────────────

test("closeInspection: rejects an empty closingNote, happy path archives the response and creates an InspectionRecord", async () => {
  const ref = "TEST-INSP-0006";
  try {
    const req = await createRegulatoryInspectionRequest(vetifySession(), {
      cacRegNumber: "RC7000006", businessName: "Test Co", inspectionRef: ref,
      inspectionScope: "Portfolio review", responseDeadline: "2026-10-31",
    });
    const resp = await respondToInspection(fiSession(), Number(req.regulatoryInspectionRequestId), {
      responseRef: "FI-RESP-1", documents: ["doc.pdf"], respondedByName: "Officer A", responseDate: "2026-10-01",
    });

    await assert.rejects(
      () =>
        closeInspection(vetifySession(), Number(resp.inspectionResponseId), {
          findings: [], passed: true, followUpNeeded: false, closingNote: "",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Closing note must not be empty",
    );

    const result = await closeInspection(vetifySession(), Number(resp.inspectionResponseId), {
      findings: ["All Murabahah contracts carry proper Qabdh evidence", "SAR reporting is timely"],
      passed: true,
      followUpNeeded: false,
      closingNote: "Inspection closed. Portfolio is Shariah-compliant.",
    });
    assert.ok(result.inspectionRecordId);

    const { rows: respRow } = await fixtureClient.query(
      "SELECT archived_at, superseded_by_kind, superseded_by_id FROM inspection_response WHERE id = $1",
      [resp.inspectionResponseId],
    );
    assert.ok(respRow[0].archived_at);
    assert.equal(respRow[0].superseded_by_kind, "inspection_record");

    const { rows: recRow } = await fixtureClient.query(
      "SELECT passed, follow_up_needed, findings, closing_note FROM inspection_record WHERE id = $1",
      [result.inspectionRecordId],
    );
    assert.equal(recRow[0].passed, true);
    assert.equal(recRow[0].follow_up_needed, false);
    assert.equal(recRow[0].findings.length, 2);
  } finally {
    await cleanup(ref);
  }
});

test("closeInspection: cannot close an already-archived response", async () => {
  const ref = "TEST-INSP-0007";
  try {
    const req = await createRegulatoryInspectionRequest(vetifySession(), {
      cacRegNumber: "RC7000007", businessName: "Test Co", inspectionRef: ref,
      inspectionScope: "Portfolio review", responseDeadline: "2026-10-31",
    });
    const resp = await respondToInspection(fiSession(), Number(req.regulatoryInspectionRequestId), {
      responseRef: "FI-RESP-1", documents: [], respondedByName: "Officer A", responseDate: "2026-10-01",
    });
    await closeInspection(vetifySession(), Number(resp.inspectionResponseId), {
      findings: [], passed: true, followUpNeeded: false, closingNote: "All clear",
    });

    await assert.rejects(
      () =>
        closeInspection(vetifySession(), Number(resp.inspectionResponseId), {
          findings: [], passed: true, followUpNeeded: false, closingNote: "Again",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "InspectionResponse is no longer active",
    );
  } finally {
    await cleanup(ref);
  }
});
