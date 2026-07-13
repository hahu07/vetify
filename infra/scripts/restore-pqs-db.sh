#!/usr/bin/env bash
# Restores the "vetify-pqs" database from a dump produced by
# backup-pqs-db.sh. See that script's header: this is a fast-rebuild
# convenience, not a data-recovery necessity — if this dump is unavailable
# or stale, the alternative is re-pointing Scribe at the Canton ledger from
# offset zero and letting it re-mirror everything, which is slower but
# equally correct.
#
# Usage: ./restore-pqs-db.sh <path-to-dump-file> [--force]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib-pg-env.sh
require_cmd pg_restore

dump_file="${1:-}"
force="${2:-}"

if [[ -z "$dump_file" || ! -f "$dump_file" ]]; then
  echo "usage: $0 <path-to-dump-file> [--force]" >&2
  echo "  (dump files live in: $BACKUP_DIR)" >&2
  echo "  (or skip this entirely and let Scribe re-mirror from the ledger — see header comment)" >&2
  exit 1
fi

echo "About to restore '${PQS_POSTGRES_DATABASE}' @ ${PQS_POSTGRES_HOST}:${PQS_POSTGRES_PORT} from:"
echo "  $dump_file"
echo "This DROPS and recreates existing tables in that database first."
if [[ "$force" != "--force" ]]; then
  read -r -p "Type the database name (${PQS_POSTGRES_DATABASE}) to confirm: " confirm
  if [[ "$confirm" != "$PQS_POSTGRES_DATABASE" ]]; then
    echo "Confirmation did not match — aborted, nothing restored." >&2
    exit 1
  fi
fi

echo "Stop the pqs (Scribe) container before restoring, or it will fight this restore over the same tables."
PGPASSWORD="$PQS_POSTGRES_PASSWORD" pg_restore \
  --host="$PQS_POSTGRES_HOST" \
  --port="$PQS_POSTGRES_PORT" \
  --username="$PQS_POSTGRES_USER" \
  --dbname="$PQS_POSTGRES_DATABASE" \
  --clean --if-exists \
  "$dump_file"

echo "Restore complete. Restart the pqs container so Scribe resumes mirroring from where the dump left off."
