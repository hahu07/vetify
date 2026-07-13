-- Adds the in-app notification feed (backend-side poller, notifications.ts) —
-- see init.sql's own comment on the notifications table for why this is a
-- poller watching PQS rather than a hook on the choice-exercise routes.
--
-- infra/postgres/init.sql only runs against a fresh database volume
-- (docker-entrypoint-initdb.d) — this project has no Flyway-style migration
-- runner for the backend-owned application tables (only PQS's Scribe-managed
-- schema has one). Run this by hand against any already-provisioned database:
--   psql -h <host> -U vetify -d vetify -f infra/postgres/migrations/003_notifications.sql
--
-- Idempotent — safe to run more than once.
CREATE TABLE IF NOT EXISTS notifications (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id),
  title              TEXT NOT NULL,
  body               TEXT NOT NULL,
  link               TEXT,
  category           TEXT NOT NULL,
  source_contract_id TEXT NOT NULL,
  read_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_contract_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
