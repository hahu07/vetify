#!/usr/bin/env bash
# Shared connection-parameter resolution for the backup/restore scripts in
# this directory. Mirrors backend/src/appdb.ts and backend/src/pqs.ts's own
# fallback chain (APP_POSTGRES_* falling back to PQS_POSTGRES_*, defaulting
# to docker-compose.yml's dev values) so these scripts work unmodified
# against the same local dev stack, and only need real env vars set to point
# at a real deployment's database.
#
# Sourced, not executed directly — has no shebang effect of its own.

: "${APP_POSTGRES_HOST:=${PQS_POSTGRES_HOST:-localhost}}"
: "${APP_POSTGRES_PORT:=${PQS_POSTGRES_PORT:-5432}}"
: "${APP_POSTGRES_USER:=${PQS_POSTGRES_USER:-vetify}}"
: "${APP_POSTGRES_PASSWORD:=${PQS_POSTGRES_PASSWORD:-vetify}}"
: "${APP_POSTGRES_DATABASE:=vetify}"

: "${PQS_POSTGRES_HOST:=localhost}"
: "${PQS_POSTGRES_PORT:=5432}"
: "${PQS_POSTGRES_USER:=vetify}"
: "${PQS_POSTGRES_PASSWORD:=vetify}"
: "${PQS_POSTGRES_DATABASE:=vetify-pqs}"

BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../backups" && pwd)}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: '$1' is required but not on PATH (install the postgresql-client package)" >&2
    exit 1
  fi
}
