#!/usr/bin/env bash
# Canton participant backup — audit finding C-1 (Phase 3 Enterprise
# Production Readiness Audit, 2026-07-08).
#
# Honesty note, deliberately checked in this shape rather than faked: this
# project's local dev/sandbox Canton node is started via
#   dpm sandbox --dar <dar> --json-api-port 7575
# with no `-c <config>` pointing at a storage backend, which means Canton
# defaults to IN-MEMORY participant storage — every contract, every party
# allocation, every ledger offset is gone the moment that process exits.
# There is nothing this or any script can back up from that: it is
# ephemeral BY DESIGN in this sandbox setup, matching
# docs/phase2-tranche-b-design.md's own framing ("no real infrastructure
# exists yet for this project beyond the local dev sandbox — there is
# nothing to run a restore drill against today").
#
# A real deployment needs the participant configured with a persistent
# storage backend (Canton supports Postgres) BEFORE this script can do
# anything real — that's a deployment-architecture decision, not something
# one script can retrofit, and it's tracked as a design item, not yet an
# implementation, in docs/phase2-tranche-b-design.md.
#
# Once that exists, back it up exactly like the other two databases in this
# directory: point CANTON_PARTICIPANT_POSTGRES_{HOST,PORT,USER,PASSWORD,DATABASE}
# at it and this script will pg_dump it the same way backup-app-db.sh does.
# Until those env vars are set, this script refuses to pretend a backup
# happened.
set -euo pipefail

if [[ -z "${CANTON_PARTICIPANT_POSTGRES_HOST:-}" ]]; then
  cat >&2 <<'EOF'
error: no persistent Canton participant storage is configured.

CANTON_PARTICIPANT_POSTGRES_HOST is unset, and this project's local sandbox
(`dpm sandbox`) runs with in-memory participant storage by default — there is
no persistent participant database anywhere to back up right now. This is not
a bug in this script; see its header comment for the full explanation.

Before this script can do anything real:
  1. Configure the target Canton participant with Postgres-backed storage
     (a deployment-architecture decision — see docs/phase2-tranche-b-design.md).
  2. Set CANTON_PARTICIPANT_POSTGRES_HOST/PORT/USER/PASSWORD/DATABASE to
     point at it.

Refusing to produce a fake/empty backup file.
EOF
  exit 1
fi

: "${CANTON_PARTICIPANT_POSTGRES_PORT:=5432}"
: "${CANTON_PARTICIPANT_POSTGRES_USER:=canton}"
: "${CANTON_PARTICIPANT_POSTGRES_DATABASE:=canton_participant}"

cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib-pg-env.sh
require_cmd pg_dump

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/canton-participant-${timestamp}.dump"

echo "Backing up '${CANTON_PARTICIPANT_POSTGRES_DATABASE}' @ ${CANTON_PARTICIPANT_POSTGRES_HOST}:${CANTON_PARTICIPANT_POSTGRES_PORT} -> ${out}"
PGPASSWORD="${CANTON_PARTICIPANT_POSTGRES_PASSWORD:-}" pg_dump \
  --host="$CANTON_PARTICIPANT_POSTGRES_HOST" \
  --port="$CANTON_PARTICIPANT_POSTGRES_PORT" \
  --username="$CANTON_PARTICIPANT_POSTGRES_USER" \
  --dbname="$CANTON_PARTICIPANT_POSTGRES_DATABASE" \
  --format=custom \
  --file="$out"

echo "Done: $(du -h "$out" | cut -f1) -> $out"
echo "This is the HIGHEST-priority backup target once it exists — restoring it is what makes every"
echo "other restore (app DB, PQS) meaningful again, since PQS and the app DB's contract_id references"
echo "are only valid relative to a specific ledger state."
