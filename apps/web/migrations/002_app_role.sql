-- Fixes a real gap found while verifying RLS end-to-end (not a hypothetical):
-- this Postgres instance's superuser bootstrap role (the Docker image's
-- default POSTGRES_USER, "vetify_web") has rolbypassrls = true, which is
-- Postgres's normal behavior for superusers -- confirmed live via
-- `SELECT rolsuper, rolbypassrls FROM pg_roles`. A first pass at this
-- vertical slice had lib/db.ts's connection pool authenticating as that same
-- superuser role, which made every RLS policy in 001's migration pass
-- silently: a cross-tenant read and even a read with NO session context set
-- at all both returned rows that should have been blocked. FORCE ROW LEVEL
-- SECURITY does not change this -- superusers bypass RLS unconditionally.
--
-- Fix: a dedicated NOSUPERUSER/NOBYPASSRLS role that only has SELECT/INSERT/
-- UPDATE (no DELETE -- this schema never physically deletes rows) on the
-- application tables. The app's connection pool (lib/db.ts) must authenticate
-- as this role, never as the migration-owning superuser.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vetify_web_app') THEN
    CREATE ROLE vetify_web_app LOGIN PASSWORD 'vetify_web_app'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO vetify_web_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO vetify_web_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vetify_web_app;

-- So tables added by future migrations are covered automatically without a
-- matching GRANT in every subsequent migration file.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO vetify_web_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO vetify_web_app;
