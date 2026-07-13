-- Adds self-serve signup support: a per-business CAC-number tenant key and a
-- per-financer dynamically-allocated Canton party (docs: signup + multi-tenant
-- isolation work, 2026-07-08).
--
-- infra/postgres/init.sql only runs against a fresh database volume
-- (docker-entrypoint-initdb.d) — this project has no Flyway-style migration
-- runner for the backend-owned application tables (only PQS's Scribe-managed
-- schema has one). Run this by hand against any already-provisioned database:
--   psql -h <host> -U vetify -d vetify -f infra/postgres/migrations/002_signup_isolation.sql
--
-- Idempotent — safe to run more than once.
ALTER TABLE users ADD COLUMN IF NOT EXISTS cac_reg_number  TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canton_party_id  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canton_party_jwt TEXT;
