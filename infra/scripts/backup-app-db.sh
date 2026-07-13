#!/usr/bin/env bash
# Backs up the backend-owned "vetify" application database — users,
# audit_log, creditworthiness_webhooks (infra/postgres/init.sql). This is
# the "Highest priority" backup target named in
# docs/phase2-tranche-b-design.md's DR section: the audit_log table is the
# ONLY place individual human attribution for governance actions survives
# (the Canton ledger itself only ever sees the shared vetify/riskCommittee
# party — see infra/postgres/init.sql's own comment), so losing this
# database without a backup loses that attribution permanently, independent
# of whatever the ledger itself still has.
#
# Usage: ./backup-app-db.sh
# Output: infra/backups/app-db-<UTC timestamp>.dump (custom pg_dump format —
#         restore with pg_restore, not psql).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib-pg-env.sh
require_cmd pg_dump

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/app-db-${timestamp}.dump"

echo "Backing up '${APP_POSTGRES_DATABASE}' @ ${APP_POSTGRES_HOST}:${APP_POSTGRES_PORT} -> ${out}"
PGPASSWORD="$APP_POSTGRES_PASSWORD" pg_dump \
  --host="$APP_POSTGRES_HOST" \
  --port="$APP_POSTGRES_PORT" \
  --username="$APP_POSTGRES_USER" \
  --dbname="$APP_POSTGRES_DATABASE" \
  --format=custom \
  --file="$out"

echo "Done: $(du -h "$out" | cut -f1) -> $out"
echo "Verify with: pg_restore --list \"$out\" | head"
