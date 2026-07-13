#!/usr/bin/env bash
# Restores the "vetify" application database from a dump produced by
# backup-app-db.sh. Destructive: --clean drops existing objects before
# recreating them, so this overwrites whatever is currently in the target
# database. Requires interactive confirmation unless --force is passed
# (for use in a scripted/CI restore-drill run).
#
# Usage: ./restore-app-db.sh <path-to-dump-file> [--force]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib-pg-env.sh
require_cmd pg_restore

dump_file="${1:-}"
force="${2:-}"

if [[ -z "$dump_file" || ! -f "$dump_file" ]]; then
  echo "usage: $0 <path-to-dump-file> [--force]" >&2
  echo "  (dump files live in: $BACKUP_DIR)" >&2
  exit 1
fi

echo "About to restore '${APP_POSTGRES_DATABASE}' @ ${APP_POSTGRES_HOST}:${APP_POSTGRES_PORT} from:"
echo "  $dump_file"
echo "This DROPS and recreates existing tables in that database first."
if [[ "$force" != "--force" ]]; then
  read -r -p "Type the database name (${APP_POSTGRES_DATABASE}) to confirm: " confirm
  if [[ "$confirm" != "$APP_POSTGRES_DATABASE" ]]; then
    echo "Confirmation did not match — aborted, nothing restored." >&2
    exit 1
  fi
fi

PGPASSWORD="$APP_POSTGRES_PASSWORD" pg_restore \
  --host="$APP_POSTGRES_HOST" \
  --port="$APP_POSTGRES_PORT" \
  --username="$APP_POSTGRES_USER" \
  --dbname="$APP_POSTGRES_DATABASE" \
  --clean --if-exists \
  "$dump_file"

echo "Restore complete. Spot-check: SELECT count(*) FROM users; SELECT count(*) FROM audit_log;"
