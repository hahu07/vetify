#!/usr/bin/env bash
# Purges old rows from creditworthiness_webhooks — see
# docs/data-retention-policy.md for the reasoning (audit finding M-6, Phase 3
# Enterprise Production Readiness Audit, 2026-07-08). This table holds a
# borrower's DSCR/credit-score data (and the full raw mono.co webhook
# payload) for as long as it takes the Underwriting Agent's poll loop to
# pick it up — there is no reason to keep it indefinitely once that's done.
#
# Dry-run by default: prints what WOULD be deleted (row count, oldest/newest
# `received_at`) without touching anything. Pass --execute to actually
# delete.
#
# Usage:
#   ./purge-creditworthiness-webhooks.sh [--execute] [retention_days]
#   retention_days defaults to $RETENTION_DAYS or 90 — this default is an
#   operational starting point, not a compliance-reviewed number; see
#   docs/data-retention-policy.md before relying on it as one.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib-pg-env.sh
require_cmd psql

execute=false
retention_days="${RETENTION_DAYS:-90}"
for arg in "$@"; do
  if [[ "$arg" == "--execute" ]]; then
    execute=true
  else
    retention_days="$arg"
  fi
done

echo "Target: '${APP_POSTGRES_DATABASE}' @ ${APP_POSTGRES_HOST}:${APP_POSTGRES_PORT}, retention window: ${retention_days} days"

summary="$(PGPASSWORD="$APP_POSTGRES_PASSWORD" psql -h "$APP_POSTGRES_HOST" -p "$APP_POSTGRES_PORT" -U "$APP_POSTGRES_USER" -d "$APP_POSTGRES_DATABASE" -tA -c "
  SELECT count(*), min(received_at), max(received_at)
  FROM creditworthiness_webhooks
  WHERE received_at < now() - interval '${retention_days} days';
")"
IFS='|' read -r count oldest newest <<< "$summary"

if [[ "$count" -eq 0 ]]; then
  echo "Nothing older than ${retention_days} days — nothing to purge."
  exit 0
fi

echo "${count} row(s) older than ${retention_days} days (oldest: ${oldest}, newest of those: ${newest})."

if [[ "$execute" != true ]]; then
  echo "Dry run only — re-run with --execute to actually delete these rows."
  exit 0
fi

PGPASSWORD="$APP_POSTGRES_PASSWORD" psql -h "$APP_POSTGRES_HOST" -p "$APP_POSTGRES_PORT" -U "$APP_POSTGRES_USER" -d "$APP_POSTGRES_DATABASE" -c "
  DELETE FROM creditworthiness_webhooks WHERE received_at < now() - interval '${retention_days} days';
"
echo "Purged ${count} row(s)."
