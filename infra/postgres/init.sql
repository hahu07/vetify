-- Create the PQS database for Scribe to write contract data into
CREATE DATABASE "vetify-pqs";

-- ─── Backend-owned application tables ──────────────────────────────────────
-- These live in the default "vetify" database (POSTGRES_DB), NOT "vetify-pqs" —
-- that database's schema is Scribe-managed (Flyway migrations) and read-only
-- from this backend's perspective; these tables are the backend's own state,
-- unrelated to ledger contract mirroring. Layer 3 of the Policy-Approval
-- Security Roadmap (docs/deferred-gaps.md): individual human accountability
-- for governance actions submitted through a shared Canton party's JWT
-- (vetify, riskCommittee) — the Canton ledger itself only ever sees the
-- shared party as the actor, so this audit trail is the actual place
-- individual attribution is proven, not the ledger.

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  -- Must match the Text name this person is registered under on-ledger
  -- (PolicyApprover.approverName, or the endorsedBy/approvedBy name they'll
  -- submit) so the backend can cross-check identity against the ledger's own
  -- registry, not just trust the login.
  display_name  TEXT NOT NULL,
  -- Which shared Canton party this user acts through when the backend
  -- submits their action to the ledger (e.g. "vetify", "riskCommittee").
  party_role    TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Layer 4 of the Policy-Approval Security Roadmap: TOTP-based MFA (RFC
  -- 6238), the software/app-based MFA half of "hardware-backed keys + MFA" —
  -- WebAuthn/FIDO2 hardware keys specifically were not built in this pass
  -- (see docs/deferred-gaps.md for why). NULL secret / enabled=false means
  -- this user hasn't opted in yet; password-only login still works for them.
  totp_secret   TEXT,
  totp_enabled  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  -- Denormalized so the audit trail survives a user record being deactivated/removed later.
  username    TEXT NOT NULL,
  display_name TEXT NOT NULL,
  party_role  TEXT NOT NULL,
  action      TEXT NOT NULL,
  contract_id TEXT,
  details     JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- mono.co's assess_creditworthiness result is delivered via webhook, not
-- returned synchronously (confirmed from mono-server.ts's own tool
-- description before this table was added) — the Underwriting Agent
-- (agents/src/agents/underwriting.ts) polls GET /api/webhooks/mono/
-- creditworthiness/:reference for this persisted result after triggering
-- the check. raw_payload keeps the full incoming webhook body, since this
-- codebase has no independently verified schema for mono.co's real webhook
-- field names (see agents/skills/underwriting/references/mono-underwriting-
-- fields.md) — dscr/credit_score are best-effort extractions, not guaranteed
-- correct against every possible real payload shape.
CREATE TABLE creditworthiness_webhooks (
  id           SERIAL PRIMARY KEY,
  reference    TEXT UNIQUE NOT NULL,
  dscr         DOUBLE PRECISION,
  credit_score DOUBLE PRECISION,
  raw_payload  JSONB NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
