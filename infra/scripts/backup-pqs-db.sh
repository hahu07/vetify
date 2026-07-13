#!/usr/bin/env bash
# Backs up the "vetify-pqs" database — Scribe's mirror of ledger contract
# data (Flyway-managed schema, read-only from the backend's perspective).
#
# docs/phase2-tranche-b-design.md deliberately rates this "Lower priority
# for backup, higher priority for fast rebuild tooling": every row here is
# derived from the Canton ledger's own transaction stream, so if the ledger
# is intact, PQS can always be rebuilt from scratch by re-subscribing Scribe
# from offset zero — this dump exists to make that rebuild fast (skip
# re-streaming the whole ledger history), not because the data is
# irreplaceable the way the app DB's audit_log is.
#
# Usage: ./backup-pqs-db.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib-pg-env.sh
require_cmd pg_dump

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/pqs-db-${timestamp}.dump"

echo "Backing up '${PQS_POSTGRES_DATABASE}' @ ${PQS_POSTGRES_HOST}:${PQS_POSTGRES_PORT} -> ${out}"
PGPASSWORD="$PQS_POSTGRES_PASSWORD" pg_dump \
  --host="$PQS_POSTGRES_HOST" \
  --port="$PQS_POSTGRES_PORT" \
  --username="$PQS_POSTGRES_USER" \
  --dbname="$PQS_POSTGRES_DATABASE" \
  --format=custom \
  --file="$out"

echo "Done: $(du -h "$out" | cut -f1) -> $out"
echo "Note: restoring the ledger itself (see backup-canton-participant.sh) always take priority —"
echo "this dump only saves the *time* of re-streaming PQS from that ledger, nothing is lost without it."
