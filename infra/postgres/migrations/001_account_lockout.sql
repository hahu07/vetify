-- Adds persistent per-account lockout to the users table (audit finding
-- M-2, Phase 3 Enterprise Production Readiness Audit, 2026-07-08).
--
-- infra/postgres/init.sql only runs against a fresh database volume
-- (docker-entrypoint-initdb.d) — this project has no Flyway-style migration
-- runner for the backend-owned application tables (only PQS's Scribe-managed
-- schema has one). Run this by hand against any already-provisioned
-- database:
--   psql -h <host> -U vetify -d vetify -f infra/postgres/migrations/001_account_lockout.sql
--
-- Idempotent — safe to run more than once.
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
