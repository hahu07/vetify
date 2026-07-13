#!/usr/bin/env bash
# One-shot bring-up for the hackathon demo path:
#   Onboarding -> Verification -> Compliance -> Underwriting -> FI Approval -> Murabahah Contract
#
# What this does NOT do: start `backend`/`frontend`/`agents` themselves (run those
# in their own terminals so you can see their logs), or put real API keys into
# agents/.env (you must do that by hand — see the printed reminder at the end).
#
# Safe to re-run from the top after a sandbox/Docker restart. Not idempotent
# against a *live* sandbox you've already set up (re-running party allocation
# against a running sandbox mints a second set of parties) — if the sandbox is
# still the one you set up last time, skip straight to starting the app.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DPM="${DPM:-$HOME/.dpm/bin/dpm}"
JSON_API_PORT="${JSON_API_PORT:-7575}"

log() { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }

command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
[ -x "$DPM" ] || { echo "dpm not found at $DPM — set DPM=/path/to/dpm"; exit 1; }

log "1/9 Docker (Postgres + PQS)"
cd "$ROOT" && docker compose up -d
sleep 3
docker ps --format '  {{.Names}}: {{.Status}}' | grep vetify || { echo "vetify-postgres/vetify-pqs not up — check docker compose logs"; exit 1; }

log "2/9 Build the DAR"
cd "$ROOT" && "$DPM" build

log "3/9 Start Canton sandbox (background)"
if curl -s -o /dev/null -w '%{http_code}' "localhost:${JSON_API_PORT}/v2/parties" 2>/dev/null | grep -q 200; then
  echo "  sandbox already responding on :${JSON_API_PORT} — reusing it, NOT reallocating parties."
  echo "  If you want a fresh sandbox, kill the old 'dpm sandbox' process first and rerun this script."
  SKIP_ALLOCATION=1
else
  nohup "$DPM" sandbox --dar "$ROOT/.daml/dist/vetify-0.3.0.dar" --json-api-port "$JSON_API_PORT" \
    > "$ROOT/sandbox.log" 2>&1 &
  echo "  sandbox pid: $! (log: $ROOT/sandbox.log)"
  for i in $(seq 1 60); do
    curl -s -o /dev/null -w '%{http_code}' "localhost:${JSON_API_PORT}/v2/parties" 2>/dev/null | grep -q 200 && break
    sleep 1
  done
  curl -s -o /dev/null -w '%{http_code}' "localhost:${JSON_API_PORT}/v2/parties" | grep -q 200 || { echo "sandbox never came up — check sandbox.log"; exit 1; }
  echo "  sandbox ready"
  SKIP_ALLOCATION=0
fi

declare -A PARTY
if [ "${SKIP_ALLOCATION:-0}" = "0" ]; then
  log "4/9 Allocate the 9 parties"
  for name in Vetify Verifier Assessor Sentinel Advisor Business FinancialInstitution Regulator RiskCommittee; do
    PID=$(curl -s -X POST "localhost:${JSON_API_PORT}/v2/parties" -H "Content-Type: application/json" \
      -d "{\"partyIdHint\":\"$name\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)['partyDetails']['party'])")
    PARTY[$name]="$PID"
    echo "  $name -> $PID"
  done

  log "5/9 Sync .env files with the new fingerprint"
  for f in backend/.env agents/.env frontend/.env; do
    for name in "${!PARTY[@]}"; do
      sed -i -E "s#${name}::[A-Za-z0-9]+#${PARTY[$name]}#g" "$ROOT/$f"
    done
  done
  echo "  updated backend/.env agents/.env frontend/.env"
  echo "  (if backend/frontend/agents are already running, restart them now)"
else
  log "4-5/9 Skipped (reusing existing sandbox + .env party IDs)"
  # Recover party IDs from backend/.env for the steps below.
  while IFS='=' read -r k v; do
    case "$k" in
      CANTON_VETIFY_PARTY_ID) PARTY[Vetify]="$v" ;;
      CANTON_VERIFIER_PARTY_ID) PARTY[Verifier]="$v" ;;
      CANTON_ASSESSOR_PARTY_ID) PARTY[Assessor]="$v" ;;
      CANTON_ADVISOR_PARTY_ID) PARTY[Advisor]="$v" ;;
      CANTON_FI_PARTY_ID) PARTY[FinancialInstitution]="$v" ;;
    esac
  done < <(grep -E '^CANTON_(VETIFY|VERIFIER|ASSESSOR|ADVISOR|FI)_PARTY_ID=' "$ROOT/backend/.env")
fi

log "6/9 Seed demo user accounts (app DB, idempotent)"
cd "$ROOT/backend" && npm run seed:users

log "7/9 Start backend temporarily to drive the REST setup calls"
cd "$ROOT/backend"
npx tsx src/index.ts > "$ROOT/backend-setup.log" 2>&1 &
BACKEND_PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null localhost:3000/health && break; sleep 1; done
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

login() {
  curl -s -X POST localhost:3000/api/auth/login -H "Content-Type: application/json" \
    -d "{\"username\":\"$1\",\"password\":\"$2\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])"
}
VETIFY_TOKEN=$(login admin@vetify.ng password123)
FI_TOKEN=$(login fi@vetify.ng password123)

log "8/9 Register governance registries + Stage 0 provider (all one-time per sandbox)"

echo "  -> AuthorizedReviewer (verifier, gates Stage 3 Approve/RejectCompliance)"
curl -s -X POST localhost:3000/api/onboarding/compliance/authorized-reviewers \
  -H "Authorization: Bearer $VETIFY_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vetify\":\"${PARTY[Vetify]}\",\"verifier\":\"${PARTY[Verifier]}\",\"authorizedBy\":\"Demo Admin\",\"role\":\"Senior Compliance Officer\"}" > /dev/null

echo "  -> AuthorizedAssessor (assessor, gates Stage 6 Begin/RejectUnderwriting)"
curl -s -X POST localhost:3000/api/financing/assessors \
  -H "Authorization: Bearer $VETIFY_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vetify\":\"${PARTY[Vetify]}\",\"assessor\":\"${PARTY[Assessor]}\",\"authorizedBy\":\"Demo Admin\",\"role\":\"Senior Underwriter\"}" > /dev/null

echo "  -> AuthorizedAdvisor (advisor, gates Shariah pre-check + Stage 8 certification)"
curl -s -X POST localhost:3000/api/onboarding/advisors \
  -H "Authorization: Bearer $VETIFY_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vetify\":\"${PARTY[Vetify]}\",\"advisor\":\"${PARTY[Advisor]}\",\"authorizedBy\":\"Demo Admin\",\"role\":\"Shariah Board Member\"}" > /dev/null

echo "  -> FinancingProviderOnboarding (FI self-registers as a Murabahah provider)"
PROVIDER=$(curl -s -X POST localhost:3000/api/providers \
  -H "Authorization: Bearer $FI_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vetify\":\"${PARTY[Vetify]}\",\"providerName\":\"Vetify Demo Islamic Bank\",\"address\":\"1 Marina, Lagos\",\"cacRegNumber\":\"RC1234567\",\"providerType\":\"CBNLicensedNIFI\",\"regulatoryBody\":\"CBN\",\"licenseNumber\":\"CBN/NIFI/0099\",\"governingDocRef\":{\"docType\":\"CBN License\",\"contentHash\":\"0000000000000000000000000000000000000000000000000000000000000000\",\"storageRef\":\"s3://vetify-docs/demo/cbn-license.pdf\"},\"declaredInstruments\":[\"Murabahah\"]}")
PROVIDER_ID=$(echo "$PROVIDER" | python3 -c "import json,sys;print(json.load(sys.stdin)['contractId'])")
echo "     contractId: $PROVIDER_ID"

curl -s -X POST "localhost:3000/api/providers/$PROVIDER_ID/submit" \
  -H "Authorization: Bearer $FI_TOKEN" > /dev/null

APPROVED=$(curl -s -X POST "localhost:3000/api/providers/$PROVIDER_ID/approve" \
  -H "Authorization: Bearer $VETIFY_TOKEN" -H "Content-Type: application/json" \
  -d '{"approvedInstruments":["Murabahah"]}')
echo "     ApprovedProvider: $(echo "$APPROVED" | python3 -c "import json,sys;print(json.load(sys.stdin)['contractId'])")"

echo "  -> AuthorizedOfficer (CreditOfficer, gates Stage 7 ApproveFunding)"
curl -s -X POST localhost:3000/api/providers/officers \
  -H "Authorization: Bearer $FI_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vetify\":\"${PARTY[Vetify]}\",\"officerId\":\"OFF-001\",\"officerName\":\"Demo Credit Officer\",\"roles\":[\"CreditOfficer\"],\"authorizedBy\":\"Demo FI Manager\"}" > /dev/null

log "9/9 Done — stopping the temporary backend"
kill $BACKEND_PID 2>/dev/null || true
trap - EXIT

cat <<'EOF'

Setup complete. Next:

1. Put real keys in agents/.env: ANTHROPIC_API_KEY, MONO_API_KEY, YOUVERIFY_API_KEY
   (party IDs are already filled in by this script).

2. In separate terminals:
     cd backend  && npm run dev
     cd frontend && npm run dev
     cd agents   && npm run dev      # Supervisor — polls every 10s, dispatches agents

3. Walk the demo:
     - Log in as business@vetify.ng / password123, submit a BusinessOnboarding,
       click "Submit for Review".
     - Watch the agents/ terminal: within ~10s the Supervisor dispatches the
       Verifier Agent, which calls the Mono/Youverify sandbox tools and the
       deterministic scoring engine auto-decides (Approve/Reject/Flag).
     - Once ApprovedBusiness exists, request financing -> FinancingRequest.
       Supervisor dispatches the Underwriting Agent the same way.
     - Log in as fi@vetify.ng / password123 -> Underwriting Queue -> ApproveFunding
       (this is the one deliberately-human decision in the flow).
     - Walk MurabahahWad -> AssetPurchaseRecord -> AcknowledgeDelivery ->
       OfferMurabahah -> CertifyShariahTerms -> AcceptProposal to reach the
       signed MurabahahContract.
EOF
