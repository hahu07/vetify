#!/usr/bin/env bash
# One-shot bring-up for the hackathon demo path:
#   Onboarding -> Verification -> Compliance -> Underwriting -> FI Approval -> Murabahah Contract
#
# What this does NOT do by default: start `backend`/`frontend`/`agents` themselves (run those
# in their own terminals so you can see their logs) — pass --start-app (or START_APP=1) to also
# bring backend+frontend up in the background as the last step, or put real API keys into
# agents/.env (you must do that by hand — see the printed reminder at the end).
#
# Safe to re-run from the top after a sandbox/Docker restart. Not idempotent against a *live*
# sandbox you've already set up (re-running party allocation against a running sandbox mints a
# second set of parties) — if the sandbox is still the one you set up last time, skip straight
# to starting the app.
# ./scripts/demo-setup.sh --start-app 2>&1 | tail -150
#./scripts/demo-setup.sh          # brings up sandbox, PQS, parties, governance registries, demo FI
# then, in separate terminals:
#cd backend  && npm run dev
#cd frontend && npm run dev
#cd agents   && npm run mock:providers   # or point at real mono.co/Youverify keys
#cd agents   && npm run mock:llm         # or point ANTHROPIC_API_KEY at the real API
#cd agents   && npm run dev              # the Supervisor
#./scripts/fast-forward-stage8-10.sh --cac RC1016635
# inventory and raw materials acquisition

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DPM="${DPM:-$HOME/.dpm/bin/dpm}"

# Root .env is the single source of truth for port overrides (docker-compose.yml already
# reads it automatically; this makes the script agree with it instead of needing every var
# exported by hand). A shell env var set before invoking this script still wins over .env,
# which still wins over the hardcoded fallback — set -a exports what .env defines, but
# ${VAR:-default} below only fills in what's still unset.
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

JSON_API_PORT="${JSON_API_PORT:-7575}"
# Overridable for machines running more than one Canton sandbox at once (confirmed live
# need: a second, unrelated Daml project already held the *entire* default 6865-6869
# block — `dpm sandbox` opens five ports, not just the Ledger API one, and Canton
# hard-crashes the node if even the sequencer/mediator admin ports collide, not just the
# ones a caller thinks to pass). Keep LEDGER_API_PORT in sync with docker-compose.yml's
# SCRIBE_SOURCE_LEDGER_PORT, which reads the same var.
LEDGER_API_PORT="${LEDGER_API_PORT:-6865}"
ADMIN_API_PORT="${ADMIN_API_PORT:-6866}"
SEQUENCER_PUBLIC_PORT="${SEQUENCER_PUBLIC_PORT:-6867}"
SEQUENCER_ADMIN_PORT="${SEQUENCER_ADMIN_PORT:-6868}"
MEDIATOR_ADMIN_PORT="${MEDIATOR_ADMIN_PORT:-6869}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
MOCK_PROVIDER_PORT="${MOCK_PROVIDER_PORT:-4100}"
MOCK_LLM_PORT="${MOCK_LLM_PORT:-4200}"
START_APP="${START_APP:-0}"
for arg in "$@"; do
  [ "$arg" = "--start-app" ] && START_APP=1
done

log()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }
warn() { printf '  \033[1;33m! %s\033[0m\n' "$1"; }
ok()   { printf '  \033[1;32m\xe2\x9c\x93 %s\033[0m\n' "$1"; }

command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
[ -x "$DPM" ] || { echo "dpm not found at $DPM — set DPM=/path/to/dpm"; exit 1; }

# Pulls a field out of a JSON API response; prints it and returns 0 on success, otherwise
# prints the response's "error" field (or the raw body, if it's not even JSON) to stderr and
# returns 1. Used everywhere below instead of the old bare `... > /dev/null`, which discarded
# failures silently — found live: a submit/approve race failed exactly this way, with the
# script printing "Setup complete" while the demo institution was never actually approved.
extract_or_fail() {
  local body="$1" field="$2" label="$3"
  local value
  value=$(echo "$body" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d['$field'])
except Exception:
    sys.exit(1)
" 2>/dev/null) && { echo "$value"; return 0; }
  local err
  err=$(echo "$body" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('error', json.dumps(d)))
except Exception:
    print(sys.stdin.read() or '(empty response)')
" 2>/dev/null)
  warn "$label failed: $err" >&2
  return 1
}

# Retries a curl+extract pair a few times with a short pause — covers the PQS read-your-writes
# lag between one ledger write and the next command that depends on reading it back (e.g.
# submit-for-review immediately followed by approve). $1: label, $2: field to extract, $3+:
# the curl command itself (via "$@" after shifting).
retry_call() {
  local label="$1" field="$2"; shift 2
  local attempt out value
  for attempt in 1 2 3 4 5; do
    out=$("$@")
    if value=$(extract_or_fail "$out" "$field" "$label" 2>/dev/null); then
      echo "$value"
      return 0
    fi
    [ "$attempt" -lt 5 ] && sleep 1
  done
  extract_or_fail "$out" "$field" "$label"
  return 1
}

log "1/10 Docker (Postgres + PQS)"
if ! docker info >/dev/null 2>&1; then
  warn "Docker daemon not running — attempting to start Docker Desktop"
  systemctl --user start docker-desktop 2>/dev/null || true
  for i in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  docker info >/dev/null 2>&1 || { echo "Docker still not reachable after waiting — start it by hand and re-run."; exit 1; }
  ok "Docker Desktop started"
fi
cd "$ROOT" && docker compose up -d
sleep 3
docker ps --format '  {{.Names}}: {{.Status}}' | grep vetify || { echo "vetify-postgres/vetify-pqs not up — check docker compose logs"; exit 1; }

log "2/10 Build the DAR"
cd "$ROOT" && "$DPM" build

log "3/10 Start Canton sandbox (background)"
synchronizer_connected() {
  curl -s "localhost:${JSON_API_PORT}/v2/state/connected-synchronizers" 2>/dev/null \
    | python3 -c "import json,sys
try:
    sys.exit(0 if json.load(sys.stdin).get('connectedSynchronizers') else 1)
except Exception:
    sys.exit(1)"
}
if curl -s -o /dev/null -w '%{http_code}' "localhost:${JSON_API_PORT}/v2/parties" 2>/dev/null | grep -q 200; then
  echo "  sandbox already responding on :${JSON_API_PORT} — reusing it, NOT reallocating parties."
  echo "  If you want a fresh sandbox, kill the old 'dpm sandbox' process first and rerun this script."
  SKIP_ALLOCATION=1
else
  nohup "$DPM" sandbox --dar "$ROOT/.daml/dist/vetify-0.3.0.dar" --json-api-port "$JSON_API_PORT" \
    --ledger-api-port "$LEDGER_API_PORT" --admin-api-port "$ADMIN_API_PORT" \
    --sequencer-public-port "$SEQUENCER_PUBLIC_PORT" --sequencer-admin-port "$SEQUENCER_ADMIN_PORT" \
    --mediator-admin-port "$MEDIATOR_ADMIN_PORT" \
    > "$ROOT/sandbox.log" 2>&1 &
  echo "  sandbox pid: $! (log: $ROOT/sandbox.log)"
  for i in $(seq 1 60); do
    curl -s -o /dev/null -w '%{http_code}' "localhost:${JSON_API_PORT}/v2/parties" 2>/dev/null | grep -q 200 && break
    sleep 1
  done
  curl -s -o /dev/null -w '%{http_code}' "localhost:${JSON_API_PORT}/v2/parties" | grep -q 200 || { echo "sandbox never came up — check sandbox.log"; exit 1; }
  # The JSON API answers /v2/parties before the participant has finished connecting to its
  # local synchronizer — allocating a party before that connection is up fails with
  # PARTY_ALLOCATION_WITHOUT_CONNECTED_SYNCHRONIZER (confirmed live). Wait for the real signal.
  echo "  JSON API up, waiting for synchronizer connection..."
  for i in $(seq 1 60); do
    synchronizer_connected && break
    sleep 1
  done
  synchronizer_connected || { echo "synchronizer never connected — check sandbox.log"; exit 1; }
  echo "  sandbox ready"
  SKIP_ALLOCATION=0
fi

declare -A PARTY
if [ "${SKIP_ALLOCATION:-0}" = "0" ]; then
  log "4/10 Allocate the 9 parties"
  # The JSON API's read path (GET /v2/parties, used by the readiness poll above) can come up
  # a beat before the write/command path — confirmed live: the very first allocation POST
  # right after "sandbox ready" can transiently fail even though an identical retry a moment
  # later succeeds. Retry each allocation a few times before giving up.
  allocate_party() {
    local name="$1" attempt
    for attempt in 1 2 3 4 5; do
      local out
      out=$(curl -s -X POST "localhost:${JSON_API_PORT}/v2/parties" -H "Content-Type: application/json" \
        -d "{\"partyIdHint\":\"$name\"}")
      local pid
      pid=$(echo "$out" | python3 -c "import json,sys
try:
    print(json.load(sys.stdin)['partyDetails']['party'])
except Exception:
    sys.exit(1)" 2>/dev/null) && { echo "$pid"; return 0; }
      sleep 1
    done
    echo "  FAILED to allocate party '$name' after 5 attempts. Last response: $out" >&2
    return 1
  }
  for name in Vetify Verifier Assessor Sentinel Advisor Business FinancialInstitution Regulator RiskCommittee; do
    PID=$(allocate_party "$name")
    PARTY[$name]="$PID"
    echo "  $name -> $PID"
  done

  log "5/10 Sync .env files with the new fingerprint"
  for f in backend/.env agents/.env frontend/.env; do
    for name in "${!PARTY[@]}"; do
      sed -i -E "s#${name}::[A-Za-z0-9]+#${PARTY[$name]}#g" "$ROOT/$f"
    done
  done
  echo "  updated backend/.env agents/.env frontend/.env"
  echo "  (if backend/frontend/agents are already running, restart them now)"
else
  log "4-5/10 Skipped (reusing existing sandbox + .env party IDs)"
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

log "6/10 Seed demo user accounts (app DB, idempotent)"
cd "$ROOT/backend" && npm run seed:users

log "7/10 Start backend temporarily to drive the REST setup calls"
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

log "8/10 Register governance registries + Stage 0 provider (all one-time per sandbox)"
SETUP_FAILED=0

echo "  -> AuthorizedReviewer (verifier, gates Stage 3 Approve/RejectCompliance)"
OUT=$(curl -s -X POST localhost:3000/api/onboarding/compliance/authorized-reviewers \
  -H "Authorization: Bearer $VETIFY_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vetify\":\"${PARTY[Vetify]}\",\"verifier\":\"${PARTY[Verifier]}\",\"authorizedBy\":\"Demo Admin\",\"role\":\"Senior Compliance Officer\"}")
extract_or_fail "$OUT" contractId "AuthorizedReviewer" >/dev/null && ok "registered" || SETUP_FAILED=1

echo "  -> AuthorizedAssessor (assessor, gates Stage 6 Begin/RejectUnderwriting)"
OUT=$(curl -s -X POST localhost:3000/api/financing/assessors \
  -H "Authorization: Bearer $VETIFY_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vetify\":\"${PARTY[Vetify]}\",\"assessor\":\"${PARTY[Assessor]}\",\"authorizedBy\":\"Demo Admin\",\"role\":\"Senior Underwriter\"}")
extract_or_fail "$OUT" contractId "AuthorizedAssessor" >/dev/null && ok "registered" || SETUP_FAILED=1

echo "  -> AuthorizedAdvisor (advisor, gates Shariah pre-check + Stage 8 certification)"
OUT=$(curl -s -X POST localhost:3000/api/onboarding/advisors \
  -H "Authorization: Bearer $VETIFY_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vetify\":\"${PARTY[Vetify]}\",\"advisor\":\"${PARTY[Advisor]}\",\"authorizedBy\":\"Demo Admin\",\"role\":\"Shariah Board Member\"}")
extract_or_fail "$OUT" contractId "AuthorizedAdvisor" >/dev/null && ok "registered" || SETUP_FAILED=1

echo "  -> FinancingProviderOnboarding (FI self-registers as a Murabahah provider)"
OUT=$(curl -s -X POST localhost:3000/api/providers \
  -H "Authorization: Bearer $FI_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vetify\":\"${PARTY[Vetify]}\",\"providerName\":\"Vetify Demo Islamic Bank\",\"address\":\"1 Marina, Lagos\",\"cacRegNumber\":\"RC1234567\",\"providerType\":\"CBNLicensedNIFI\",\"regulatoryBody\":\"CBN\",\"licenseNumber\":\"CBN/NIFI/0099\",\"governingDocRef\":{\"docType\":\"CBN License\",\"contentHash\":\"0000000000000000000000000000000000000000000000000000000000000000\",\"storageRef\":\"s3://vetify-docs/demo/cbn-license.pdf\"},\"declaredInstruments\":[\"Murabahah\"]}")
if PROVIDER_ID=$(extract_or_fail "$OUT" contractId "FinancingProviderOnboarding create"); then
  ok "created: $PROVIDER_ID"

  echo "  -> submit for review"
  # Retried: the very next call (approve, below) reads this status back via PQS, which can
  # lag a beat behind the ledger write — this is the exact race that silently failed before.
  if SUBMIT_ID=$(retry_call "submit-for-review" contractId \
      curl -s -X POST "localhost:3000/api/providers/$PROVIDER_ID/submit" -H "Authorization: Bearer $FI_TOKEN"); then
    ok "submitted: $SUBMIT_ID"

    echo "  -> approve (Vetify)"
    if APPROVED_ID=$(retry_call "ApproveProvider" contractId \
        curl -s -X POST "localhost:3000/api/providers/$SUBMIT_ID/approve" \
          -H "Authorization: Bearer $VETIFY_TOKEN" -H "Content-Type: application/json" \
          -d '{"approvedInstruments":["Murabahah"]}'); then
      ok "ApprovedProvider: $APPROVED_ID"
    else
      SETUP_FAILED=1
    fi
  else
    SETUP_FAILED=1
  fi
else
  SETUP_FAILED=1
fi

echo "  -> AuthorizedOfficer (CreditOfficer, gates Stage 7 ApproveFunding)"
OUT=$(curl -s -X POST localhost:3000/api/providers/officers \
  -H "Authorization: Bearer $FI_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vetify\":\"${PARTY[Vetify]}\",\"officerId\":\"OFF-001\",\"officerName\":\"Demo Credit Officer\",\"roles\":[\"CreditOfficer\"],\"authorizedBy\":\"Demo FI Manager\"}")
extract_or_fail "$OUT" contractId "AuthorizedOfficer" >/dev/null && ok "registered" || SETUP_FAILED=1

log "9/10 Verify everything that was just registered is actually there"
# Re-reads each registry back through its own list endpoint rather than trusting the create
# calls above — catches anything that silently failed (or a write PQS hasn't indexed yet).
verify_nonempty() {
  local label="$1" url="$2" token="$3"
  local count
  count=$(curl -s "$url" -H "Authorization: Bearer $token" | python3 -c "import json,sys
try:
    print(len(json.load(sys.stdin)))
except Exception:
    print(0)" 2>/dev/null)
  if [ "${count:-0}" -gt 0 ]; then
    ok "$label ($count)"
  else
    warn "$label — NOT FOUND"
    SETUP_FAILED=1
  fi
}
verify_nonempty "AuthorizedReviewer"  "localhost:3000/api/onboarding/compliance/authorized-reviewers" "$VETIFY_TOKEN"
verify_nonempty "AuthorizedAssessor"  "localhost:3000/api/financing/assessors" "$VETIFY_TOKEN"
verify_nonempty "AuthorizedAdvisor"   "localhost:3000/api/onboarding/advisors" "$VETIFY_TOKEN"
verify_nonempty "ApprovedProvider"    "localhost:3000/api/providers/approved" "$VETIFY_TOKEN"
verify_nonempty "AuthorizedOfficer"   "localhost:3000/api/providers/officers" "$VETIFY_TOKEN"

if [ "$SETUP_FAILED" -eq 1 ]; then
  echo
  warn "One or more setup steps failed or could not be verified — see the ! lines above."
  warn "Re-running this script is usually safe (registries/provider registration are effectively"
  warn "idempotent against the same sandbox); if it keeps failing, check backend-setup.log."
fi

log "10/10 Stopping the temporary backend"
kill $BACKEND_PID 2>/dev/null || true
trap - EXIT

if [ "$START_APP" = "1" ]; then
  log "Starting backend + frontend in the background (--start-app)"
  cd "$ROOT/backend" && nohup npx tsx src/index.ts > "$ROOT/backend.log" 2>&1 &
  echo "  backend pid: $! (log: $ROOT/backend.log)"
  for i in $(seq 1 30); do curl -s -o /dev/null localhost:3000/health && break; sleep 1; done
  cd "$ROOT/frontend" && PORT="$FRONTEND_PORT" nohup npm run dev > "$ROOT/frontend.log" 2>&1 &
  echo "  frontend pid: $! (log: $ROOT/frontend.log)"
  for i in $(seq 1 30); do curl -s -o /dev/null "localhost:${FRONTEND_PORT}" && break; sleep 1; done
  ok "backend: http://localhost:3000  frontend: http://localhost:${FRONTEND_PORT}"
fi

cat <<EOF

Setup $([ "$SETUP_FAILED" -eq 1 ] && echo "finished WITH WARNINGS (see above)" || echo "complete"). Next:

1. Put a real key in agents/.env: ANTHROPIC_API_KEY (only needed if you point ANTHROPIC_BASE_URL
   back at the real API — left as "mock-key" by default, since ANTHROPIC_BASE_URL points at
   localhost:${MOCK_LLM_PORT}, the local mock standing in for Claude itself). MONO_API_KEY/
   YOUVERIFY_API_KEY are likewise left as "mock-key" with MONO_BASE_URL/YOUVERIFY_BASE_URL
   pointing at localhost:${MOCK_PROVIDER_PORT} — the local mock standing in for mono.co/Youverify.
   No third-party signup or real LLM spend needed at all. Point any of these back at the real
   APIs (+ real keys) if you'd rather go live for one piece at a time.

2. $([ "$START_APP" = "1" ] && echo "backend + frontend are already running in the background (see above)." || echo "In separate terminals:
     cd backend  && npm run dev
     cd frontend && PORT=$FRONTEND_PORT npm run dev")
     cd agents   && npm run mock:providers   # canned mono.co/Youverify responses on :${MOCK_PROVIDER_PORT}
     cd agents   && npm run mock:llm         # scripted Claude stand-in on :${MOCK_LLM_PORT}
     cd agents   && npm run dev              # Supervisor — polls every 10s, dispatches agents

   MOCK_SCENARIO=flag or MOCK_SCENARIO=reject (env var — set it identically on BOTH the
   mock:providers and mock:llm processes, they must agree) switches the canned identity/AML
   data to demo the Medium-risk-flag or hard-reject branches instead of the default
   clean/auto-approve path.

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
