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
  totp_enabled  BOOLEAN NOT NULL DEFAULT false,
  -- Persistent per-account lockout (audit finding M-2, Phase 3 Enterprise
  -- Production Readiness Audit, 2026-07-08 — the follow-up deliberately left
  -- out of the earlier pass that added IP-based rate limiting, since IP
  -- throttling alone doesn't stop a distributed attack rotating source IPs
  -- against one username). failed_login_attempts resets to 0 on a
  -- successful login; locked_until is set once the threshold is crossed and
  -- expires on its own — see auth.ts's ACCOUNT_LOCKOUT_THRESHOLD/_MINUTES.
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  -- Self-serve signup tenant-scoping keys (migrations/002_signup_isolation.sql).
  -- Business tenant key: the CAC registration number this account's
  -- BusinessOnboarding was created with (NULL until their first submission —
  -- BusinessOnboarding's ledger key is (borrower, cacRegNumber), so multiple
  -- businesses already coexist under the one shared "borrower" party,
  -- differentiated by this field). UNIQUE so two accounts can never claim the
  -- same business.
  cac_reg_number  TEXT UNIQUE,
  -- Financer tenant key: a dynamically-allocated Canton party (POST
  -- /v2/parties) minted at signup, one per financial institution — required
  -- because FinancingProviderOnboarding's key (financialInstitution, vetify)
  -- only allows ONE draft ledger-wide under the single shared
  -- "financialInstitution" party. NULL for business/vetify/riskCommittee
  -- accounts and for the legacy pre-migration demo account.
  canton_party_id  TEXT,
  -- Placeholder ("") in this NoAuth dev sandbox, where no bearer token is
  -- actually validated — a real deployment would store a genuine per-party
  -- JWT issued by that participant's IdP here instead (docs/secrets-custody.md).
  canton_party_jwt TEXT
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

-- In-app notification feed. Populated by a backend-side poller (notifications.ts)
-- watching PQS for new UnderwritingResult/UnderwritingRejection contracts, not by
-- hooking the choice-exercise routes directly — the autonomous Underwriting Agent
-- (agents/ package) calls Canton's MCP tools straight through to the ledger,
-- bypassing this backend's REST routes entirely, so a route-level hook would miss
-- every autonomous decision and only ever fire for the dev-tools simulator or a
-- human's ACP/portal action. Watching the ledger itself (via PQS, which mirrors
-- every write regardless of who made it) is the only point that sees all three
-- paths uniformly.
--
-- source_contract_id + user_id is UNIQUE so re-scanning the full active() set on
-- every poll (rather than tracking a cursor/offset) is naturally idempotent — the
-- poller can re-derive "have I already notified this recipient about this
-- contract" from the table itself instead of needing separate cursor state that
-- could drift or be lost on a restart.
CREATE TABLE notifications (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id),
  title              TEXT NOT NULL,
  body               TEXT NOT NULL,
  -- Frontend route to navigate to when this notification is clicked, e.g. "/business/financing".
  link               TEXT,
  category           TEXT NOT NULL,
  source_contract_id TEXT NOT NULL,
  read_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_contract_id, user_id)
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
