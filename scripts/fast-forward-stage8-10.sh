#!/usr/bin/env bash
# Drives an already-FI-approved business (a live MurabahahWad exists) straight through the
# Murabahah acquisition chain (Stage 8), every repayment installment (Stage 9), and closure
# (Stage 10) via real backend API calls — no ledger shortcuts, just skipping the manual UI
# clicks so a demo recording doesn't have to sit through 7+ clicks that have no agent/AI
# narrative attached to them (Stage 7 is the only human decision point in the whole pipeline;
# everything from here on is FI/business paperwork).
#
# Requires: the target business already has a live MurabahahWad (i.e. the FI has already
# exercised ApproveFunding on their FinancingRequest — this script does NOT do Stage 7).
#
# Usage:
#   ./scripts/fast-forward-stage8-10.sh --cac RC1234568 [--profit-pct 15] [--stop-after N] [--no-close]
#
#   --profit-pct  Profit margin applied to the asset's estimated cost (default 15).
#   --stop-after  Only pay the first N installments, then stop (default: pay all).
#   --no-close    Skip Stage 10's CloseContract even if every installment was paid —
#                 useful if you want to film Stage 9's "in progress" state deliberately.
#
# Prints the final MurabahahContract id on the last line of stdout so a caller (e.g.
# record-demo.sh) can capture it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="${API:-http://localhost:3000}"
PROFIT_PCT=15
STOP_AFTER=""
DO_CLOSE=1
CAC=""

while [ $# -gt 0 ]; do
  case "$1" in
    --cac) CAC="$2"; shift 2 ;;
    --profit-pct) PROFIT_PCT="$2"; shift 2 ;;
    --stop-after) STOP_AFTER="$2"; shift 2 ;;
    --no-close) DO_CLOSE=0; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done
[ -n "$CAC" ] || { echo "Usage: $0 --cac <cacRegNumber> [--profit-pct N] [--stop-after N] [--no-close]" >&2; exit 1; }

command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }

log()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$1" >&2; }
warn() { printf '  \033[1;33m! %s\033[0m\n' "$1" >&2; }
ok()   { printf '  \033[1;32m\xe2\x9c\x93 %s\033[0m\n' "$1" >&2; }

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
  warn "$label failed: $err"
  return 1
}

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

login() {
  curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
    -d "{\"username\":\"$1\",\"password\":\"$2\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])"
}

log "Logging in (business / financer / vetify)"
BUSINESS_TOKEN=$(login business@vetify.ng password123)
FI_TOKEN=$(login fi@vetify.ng password123)
VETIFY_TOKEN=$(login admin@vetify.ng password123)
ok "logged in"

log "Finding the live MurabahahWad for $CAC"
WAD=$(curl -s "$API/api/financing/wads?cacRegNumber=$CAC" -H "Authorization: Bearer $VETIFY_TOKEN" \
  | python3 -c "import json,sys
rows = json.load(sys.stdin)
if not rows:
    sys.exit(1)
print(json.dumps(rows[0]))")
[ -n "$WAD" ] || { echo "No live MurabahahWad found for CAC $CAC — has the FI run ApproveFunding yet?" >&2; exit 1; }
WAD_ID=$(echo "$WAD" | python3 -c "import json,sys;print(json.load(sys.stdin)['contractId'])")
ACTUAL_COST=$(echo "$WAD" | python3 -c "import json,sys;print(json.load(sys.stdin)['payload']['assetDetails']['estimatedCost'])")
TENURE=$(echo "$WAD" | python3 -c "import json,sys;print(json.load(sys.stdin)['payload']['terms']['tenureMonths'])")
ok "Wad $WAD_ID — estimatedCost=$ACTUAL_COST tenureMonths=$TENURE"

log "Stage 8a: ProceedDirectly (FI purchases the asset)"
TODAY=$(date -u +%Y-%m-%d)
PURCHASE_ID=$(retry_call "ProceedDirectly" contractId \
  curl -s -X POST "$API/api/financing/wads/$WAD_ID/proceed-directly" \
    -H "Authorization: Bearer $FI_TOKEN" -H "Content-Type: application/json" \
    -d "{\"actualCost\":$ACTUAL_COST,\"purchaseDate\":\"$TODAY\",\"invoiceRef\":\"INV-FASTFWD-$(date +%s)\"}")
ok "AssetPurchaseRecord: $PURCHASE_ID"

log "Stage 8b: AcknowledgeDelivery (business confirms Qabdh)"
PURCHASE_ID=$(retry_call "AcknowledgeDelivery" contractId \
  curl -s -X POST "$API/api/financing/purchase-records/$PURCHASE_ID/acknowledge-delivery" \
    -H "Authorization: Bearer $BUSINESS_TOKEN")
ok "acknowledged: $PURCHASE_ID"

log "Stage 8c: OfferMurabahah (FI's Ijab — cost + disclosed profit)"
read -r PROFIT_AMOUNT SALE_PRICE INSTALLMENT_AMOUNT <<< "$(python3 -c "
cost = float('$ACTUAL_COST')
profit = round(cost * $PROFIT_PCT / 100, 2)
sale = round(cost + profit, 2)
installment = round(sale / $TENURE, 2)
print(profit, sale, installment)
")"
PAYMENT_SCHEDULE=$(python3 -c "
import json
from datetime import date

def add_months(d, n):
    m = d.month - 1 + n
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, [31,29 if y%4==0 and (y%100!=0 or y%400==0) else 28,31,30,31,30,31,31,30,31,30,31][m-1])
    return date(y, m, day)

start = date.today()
sched = [{'installmentNo': i + 1, 'dueDate': add_months(start, i).isoformat(), 'dueAmount': $INSTALLMENT_AMOUNT} for i in range($TENURE)]
print(json.dumps(sched))
")
OFFER_BODY=$(python3 -c "
import json
print(json.dumps({
    'murabahahTerms': {'assetCost': $ACTUAL_COST, 'profitAmount': $PROFIT_AMOUNT, 'salePrice': $SALE_PRICE, 'installmentAmount': $INSTALLMENT_AMOUNT, 'tenureMonths': $TENURE},
    'paymentSchedule': $PAYMENT_SCHEDULE,
    'startDate': '$TODAY',
}))
")
# OfferMurabahah's Daml body creates a PaymentScheduleContract BEFORE the
# MurabahahProposal itself (Murabahah.daml) — the exercise response's own
# `contractId` (first CreatedEvent in the transaction) is therefore that
# schedule contract, NOT the proposal. Confirmed live: passing it straight
# into CertifyShariahTerms fails with WRONGLY_TYPED_CONTRACT. The real
# frontend (AcquisitionQueue.tsx) never trusts that field either — it just
# invalidates and refetches GET /financing/proposals. Do the same here.
retry_call "OfferMurabahah" contractId \
  curl -s -X POST "$API/api/financing/purchase-records/$PURCHASE_ID/offer-murabahah" \
    -H "Authorization: Bearer $FI_TOKEN" -H "Content-Type: application/json" -d "$OFFER_BODY" >/dev/null
PROPOSAL_ID=""
for attempt in 1 2 3 4 5; do
  PROPOSAL_ID=$(curl -s "$API/api/financing/proposals?cacRegNumber=$CAC" -H "Authorization: Bearer $VETIFY_TOKEN" \
    | python3 -c "import json,sys
rows = json.load(sys.stdin)
print(rows[-1]['contractId']) if rows else sys.exit(1)" 2>/dev/null) && break
  sleep 1
done
[ -n "$PROPOSAL_ID" ] || { echo "Could not find the new MurabahahProposal for $CAC after OfferMurabahah" >&2; exit 1; }
ok "MurabahahProposal: $PROPOSAL_ID (salePrice=$SALE_PRICE, installment=$INSTALLMENT_AMOUNT x $TENURE)"

log "Stage 8d: CertifyShariahTerms (SSB sign-off, G11)"
CERT_BODY=$(python3 -c "
import json
print(json.dumps({
    'certificationRef': 'CERT-FASTFWD-$(date +%s)',
    'aaoifiStandards': ['AAOIFI SS 8'],
    'rationale': 'Fast-forwarded for demo recording: standard cost-plus Murabahah, no red flags.',
    'certifiedBy': 'Demo Shari\'a Advisor',
}))
")
CERT_ID=$(retry_call "CertifyShariahTerms" contractId \
  curl -s -X POST "$API/api/financing/proposals/$PROPOSAL_ID/certify-shariah" \
    -H "Authorization: Bearer $VETIFY_TOKEN" -H "Content-Type: application/json" -d "$CERT_BODY")
ok "ShariahContractCertification: $CERT_ID"

log "Stage 8e: AcceptProposal (business's Qabul -> binding MurabahahContract)"
CONTRACT_ID=$(retry_call "AcceptProposal" contractId \
  curl -s -X POST "$API/api/financing/proposals/$PROPOSAL_ID/accept" \
    -H "Authorization: Bearer $BUSINESS_TOKEN" -H "Content-Type: application/json" \
    -d "{\"certificationCid\":\"$CERT_ID\"}")
ok "MurabahahContract: $CONTRACT_ID"

log "Stage 9: recording repayments"
N_INSTALLMENTS="$TENURE"
[ -n "$STOP_AFTER" ] && [ "$STOP_AFTER" -lt "$N_INSTALLMENTS" ] && N_INSTALLMENTS="$STOP_AFTER"
for i in $(seq 1 "$N_INSTALLMENTS"); do
  DUE_DATE=$(echo "$PAYMENT_SCHEDULE" | python3 -c "import json,sys;print([e for e in json.load(sys.stdin) if e['installmentNo']==$i][0]['dueDate'])")
  # salePrice / TENURE is rounded to 2dp per installment (see PROFIT_AMOUNT/SALE_PRICE/
  # INSTALLMENT_AMOUNT above) — paying that same rounded amount on every installment,
  # including the last, overshoots the true sale price by a few kobo whenever it doesn't
  # divide evenly (confirmed live: RecordPayment #12 on a 12-month schedule failed with
  # "Payment exceeds outstanding balance"). The last installment instead pays exactly
  # what's left, absorbing the rounding — same convention a real amortization schedule uses.
  if [ "$i" = "$N_INSTALLMENTS" ] && [ "$N_INSTALLMENTS" = "$TENURE" ]; then
    AMOUNT=$(python3 -c "print(round($SALE_PRICE - $INSTALLMENT_AMOUNT * ($TENURE - 1), 2))")
  else
    AMOUNT="$INSTALLMENT_AMOUNT"
  fi
  CONTRACT_ID=$(retry_call "RecordPayment #$i" contractId \
    curl -s -X POST "$API/api/contracts/$CONTRACT_ID/record-payment" \
      -H "Authorization: Bearer $FI_TOKEN" -H "Content-Type: application/json" \
      -d "{\"paymentDate\":\"$DUE_DATE\",\"amountPaid\":$AMOUNT,\"installmentNo\":$i}")
  ok "installment $i/$TENURE paid — contract now $CONTRACT_ID"
done

if [ "$DO_CLOSE" = "1" ] && [ "$N_INSTALLMENTS" = "$TENURE" ]; then
  log "Stage 10: CloseContract"
  CONTRACT_ID=$(retry_call "CloseContract" contractId \
    curl -s -X POST "$API/api/contracts/$CONTRACT_ID/close" \
      -H "Authorization: Bearer $FI_TOKEN" -H "Content-Type: application/json" \
      -d "{\"closingDate\":\"$(date -u +%Y-%m-%d)\"}")
  ok "Completed: $CONTRACT_ID"
else
  log "Stage 10 skipped ($([ "$DO_CLOSE" = "0" ] && echo "--no-close" || echo "only $N_INSTALLMENTS/$TENURE installments paid") — contract left at $CONTRACT_ID"
fi

echo "$CONTRACT_ID"
