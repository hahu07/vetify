-- Phase 2, Twenty-Ninth Slice -- the regulatory inspection workflow: vetify
-- creates RegulatoryInspectionRequest directly (no exercised choice creates
-- it in the real Daml -- verified against MurabahahTests.daml's M-RI test,
-- which submits a bare `createCmd` as vetify), the FI responds
-- (RespondToInspection, consuming, archives the request and creates
-- InspectionResponse), and vetify closes it (CloseInspection, consuming,
-- archives the response and creates the immutable InspectionRecord).
-- ExtendDeadline is a small side choice, vetify-controlled.
--
-- Unlike most Murabahah-area templates ported so far, none of these three
-- carry a `business` observer at all (`observer [financialInstitution] ++
-- optional [] pure regulator` on all three) -- this is CBN oversight of the
-- FI's own compliance posture, not something the underlying business sees.
-- Select policies below deliberately omit the business tenant-scoped OR
-- clause every other Murabahah-area table carries.
--
-- None of the three real Daml templates carry a proper FK back to each
-- other (inspectionRef : Text is the only correlation across all three,
-- and it's not ledger-enforced without a contract key) -- this migration
-- adds real FK columns (regulatory_inspection_request_id,
-- inspection_response_id) as traceability, the same convention
-- asset_purchase_record.murabahah_wad_id already established.

-- ─── RegulatoryInspectionRequest ────────────────────────────────────────────

CREATE TABLE regulatory_inspection_request (
  id                 BIGSERIAL PRIMARY KEY,
  cac_reg_number     TEXT NOT NULL,
  business_name      TEXT NOT NULL,
  inspection_ref     TEXT NOT NULL CHECK (inspection_ref <> ''),
  inspection_scope   TEXT NOT NULL,
  response_deadline  DATE NOT NULL,
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at        TIMESTAMPTZ,
  superseded_by_kind TEXT,
  superseded_by_id   BIGINT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE regulatory_inspection_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_inspection_request FORCE ROW LEVEL SECURITY;

CREATE POLICY regulatory_inspection_request_select ON regulatory_inspection_request
  FOR SELECT
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

-- Direct creation by vetify only.
CREATE POLICY regulatory_inspection_request_insert ON regulatory_inspection_request
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ExtendDeadline (vetify, keyless field-replace) and RespondToInspection's
-- archive-on-supersede (financialInstitution) both write this table --
-- known from reading both choices' controllers up front, so both roles are
-- granted from the start rather than discovered as a gap later.
CREATE POLICY regulatory_inspection_request_update ON regulatory_inspection_request
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution'));

-- ─── InspectionResponse ─────────────────────────────────────────────────────
-- Created via consuming RespondToInspection on RegulatoryInspectionRequest.
-- signatory financialInstitution; observer vetify, regulator.

CREATE TABLE inspection_response (
  id                             BIGSERIAL PRIMARY KEY,
  regulatory_inspection_request_id BIGINT NOT NULL REFERENCES regulatory_inspection_request(id),
  cac_reg_number                 TEXT NOT NULL,
  business_name                  TEXT NOT NULL,
  inspection_ref                 TEXT NOT NULL,
  response_ref                   TEXT NOT NULL CHECK (response_ref <> ''),
  documents                      JSONB NOT NULL DEFAULT '[]',
  responded_by_name              TEXT NOT NULL CHECK (responded_by_name <> ''),
  response_date                  DATE NOT NULL,
  archived_at                    TIMESTAMPTZ,
  superseded_by_kind             TEXT,
  superseded_by_id               BIGINT,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inspection_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_response FORCE ROW LEVEL SECURITY;

CREATE POLICY inspection_response_select ON inspection_response
  FOR SELECT
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY inspection_response_insert ON inspection_response
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- CloseInspection's archive-on-supersede is vetify-controlled.
CREATE POLICY inspection_response_update ON inspection_response
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── InspectionRecord ───────────────────────────────────────────────────────
-- Created via consuming CloseInspection on InspectionResponse. Immutable --
-- no further choices in the real Daml. signatory vetify; observer
-- financialInstitution, regulator.

CREATE TABLE inspection_record (
  id                       BIGSERIAL PRIMARY KEY,
  inspection_response_id   BIGINT NOT NULL REFERENCES inspection_response(id),
  cac_reg_number           TEXT NOT NULL,
  business_name            TEXT NOT NULL,
  inspection_ref           TEXT NOT NULL,
  findings                 JSONB NOT NULL DEFAULT '[]',
  passed                   BOOLEAN NOT NULL,
  follow_up_needed         BOOLEAN NOT NULL,
  closing_note             TEXT NOT NULL CHECK (closing_note <> ''),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inspection_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_record FORCE ROW LEVEL SECURITY;

CREATE POLICY inspection_record_select ON inspection_record
  FOR SELECT
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY inspection_record_insert ON inspection_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
