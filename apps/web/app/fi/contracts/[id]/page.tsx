"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { X } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { formatNaira, formatDate } from "@/lib/formatters";
import {
  useMurabahahContracts,
  useRepaymentRecords,
  useRecordPayment,
  useCloseContract,
  useLatePaymentCharities,
  useSetCharityAmount,
  useIbraRequests,
  useGrantIbra,
  useDeclineIbra,
  useProposeRebate,
  useGrantPartialIbra,
  useTakafulPolicies,
  useCreateTakafulPolicy,
  useOfficers,
  useDefaultContract,
  useCloseDefaultedContract,
  useRahnAgreements,
  usePledgeCollateral,
  useReleaseCollateral,
  useEnforceCollateral,
  useCollateralValuationDocuments,
  useCollateralValuationRecords,
  useCollateralInspectionRecords,
  useRevalue,
  useRecordInspection,
  usePendingCollateralEnforcements,
  useProposeEnforceCollateral,
  useRestructuringRequests,
  useApproveRestructuring,
  useRejectRestructuring,
  useDisputeRecords,
  useArbitrationRequests,
  useDirectDebitMandates,
  useCreateDirectDebitMandate,
  useSuspendMandate,
  useReinstateMandate,
  useCancelMandate,
  useDirectDebitCollectionAttempts,
  useRecordCollectionAttempt,
  useRecoveryPaymentRecords,
  useRecordRecoveryPayment,
  useGsmInvocations,
  useCreateGsmInvocation,
  useRecordGsmSweep,
  useCancelGsm,
  useGrantMoratorium,
  useHamishJiddiyyah,
  useCreateHamishJiddiyyah,
  useReturnDeposit,
  useForfeitDeposit,
  useWriteOffContract,
  useDemandNotices,
  useIssueDemandNotice,
  useWithdrawDemand,
  useEscalateToLegal,
  useLegalEscalations,
  useRecordCourtOrder,
  useResolveLegal,
  useGuaranteeAgreements,
  useCreateGuaranteeAgreement,
  useEnforceGuarantee,
  useReleaseGuarantee,
  useCreditCovenants,
  useCreateCreditCovenant,
  type IbraRequestItem,
  type RahnAgreementItem,
  type PaymentScheduleEntry,
  type DemandNoticeItem,
  type GuaranteeAgreementItem,
} from "@/lib/apiClient";

// New page -- Stage 9-10 detail view: outstanding balance, installment
// progress, repayment history, and the FI's RecordPayment/CloseContract
// actions. No single-contract GET route exists (only the list), so this
// finds the row client-side from useMurabahahContracts, matching the
// existing compliance/[id] page's pattern.
//
// Phase 2, fifth slice added: LatePaymentCharity settlement
// (SetCharityAmount), Ibra requests (GrantIbra's four-eyes officer check,
// DeclineIbra), and DefaultContract/CloseDefaultedContract -- see
// migrations/010_murabahah_ibra_charity_default.sql's header for scope.
// Phase 2, sixth slice adds RahnAgreement collateral (PledgeCollateral,
// ReleaseCollateral/EnforceCollateral -- both four-eyes, reusing the same
// AuthorizedOfficer registry GrantIbra already consumes, with a different
// role pair per choice) -- see
// migrations/011_rahn_agreement_collateral.sql's header for scope.
// Phase 2, seventh slice adds read-only display of business-submitted
// collateral valuation documents in the Collateral card below -- see
// migrations/012_collateral_valuation_document.sql's header for scope.
// Phase 2, eighth slice adds ApproveRestructuring/RejectRestructuring (FI
// authority) here; EscalateToArbitration/RecordArbitrationOutcome are
// vetify's authority in Daml (controller vetify on DisputeRecord/
// ArbitrationRequest), so those actions live on /vetify/disputes instead --
// this page only shows disputes read-only. See
// migrations/013_murabahah_restructuring_disputes.sql's header for scope.
// Phase 2, ninth slice adds Collections: DirectDebitMandate lifecycle,
// DirectDebitCollectionAttempt logging, and GSMInvocation/RecordGSMSweep/
// CancelGSM -- all financialInstitution-controlled, procedural (the
// Collections Agent), not a scored decision. See
// migrations/014_murabahah_collections.sql's header for scope.
// Phase 2, tenth slice adds GrantMoratorium (financialInstitution -- shown
// here) and HamishJiddiyyah's create/ReturnDeposit/ForfeitDeposit (also
// financialInstitution). EndMoratorium is `controller vetify` in Daml, so
// that action lives on /vetify/delinquency instead, mirroring the eighth
// slice's dispute-escalation placement lesson. See
// migrations/015_murabahah_moratorium_hamish.sql's header for scope.

const DISPUTE_TYPE_LABELS: Record<string, string> = {
  PaymentDispute: "Payment Dispute",
  ContractTermsDispute: "Contract Terms Dispute",
  AssetDefectDispute: "Asset Defect Dispute",
};

const RECOVERY_SOURCES = [
  { value: "COLLATERAL_SALE", label: "Collateral Sale" },
  { value: "GUARANTOR", label: "Guarantor" },
  { value: "COURT_JUDGMENT", label: "Court Judgment" },
  { value: "VOLUNTARY", label: "Voluntary" },
];

function GrantIbraModal({ request, onClose }: { request: IbraRequestItem; onClose: () => void }) {
  const { data: officers } = useOfficers();
  const [rebateAmount, setRebateAmount] = useState(0);
  const [proposedByOfficerId, setProposedByOfficerId] = useState("");
  const [confirmedByOfficerId, setConfirmedByOfficerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const grant = useGrantIbra();

  const creditOfficers = (officers ?? []).filter((o) => o.active && o.roles.includes("CreditOfficer"));
  const riskOfficers = (officers ?? []).filter((o) => o.active && o.roles.includes("RiskOfficer"));

  const handleConfirm = async () => {
    setError(null);
    if (!proposedByOfficerId || !confirmedByOfficerId) {
      setError("Both a proposing CreditOfficer and a confirming RiskOfficer are required (four-eyes)");
      return;
    }
    if (proposedByOfficerId === confirmedByOfficerId) {
      setError("Confirming officer must differ from proposing officer (four-eyes)");
      return;
    }
    try {
      await grant.mutateAsync({ id: request.id, rebateAmount, proposedByOfficerId, confirmedByOfficerId });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to grant Ibra");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Grant Ibra&apos; (Early Settlement Rebate)</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Outstanding: {formatNaira(request.outstandingBalance)}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Rebate Amount (NGN)</label>
          <input type="number" className="input font-mono" value={rebateAmount} onChange={(e) => setRebateAmount(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Proposed By (CreditOfficer)</label>
          <select className="input" value={proposedByOfficerId} onChange={(e) => setProposedByOfficerId(e.target.value)}>
            <option value="">Select an officer…</option>
            {creditOfficers.map((o) => (
              <option key={o.id} value={o.officer_id}>
                {o.officer_name} ({o.officer_id})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Confirmed By (RiskOfficer, four-eyes)</label>
          <select className="input" value={confirmedByOfficerId} onChange={(e) => setConfirmedByOfficerId(e.target.value)}>
            <option value="">Select an officer…</option>
            {riskOfficers.map((o) => (
              <option key={o.id} value={o.officer_id}>
                {o.officer_name} ({o.officer_id})
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={grant.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {grant.isPending ? "Submitting…" : "Grant Ibra'"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Phase 2, Forty-Second Slice: GrantPartialIbra (mirrors GrantIbra's
// four-eyes officer check exactly, but only valid on a PartialIbra request --
// GrantIbra itself only works on FullIbra, a distinction the render call
// below did not previously enforce; see the button-gating fix there) and
// ProposeRebate (a lighter-weight FI counter-offer, no officer check).

function GrantPartialIbraModal({ request, onClose }: { request: IbraRequestItem; onClose: () => void }) {
  const { data: officers } = useOfficers();
  const [rebateAmount, setRebateAmount] = useState(0);
  const [approvedSettlementAmount, setApprovedSettlementAmount] = useState(Math.round(request.outstandingBalance * 0.9));
  const [proposedByOfficerId, setProposedByOfficerId] = useState("");
  const [confirmedByOfficerId, setConfirmedByOfficerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const grant = useGrantPartialIbra();

  const creditOfficers = (officers ?? []).filter((o) => o.active && o.roles.includes("CreditOfficer"));
  const riskOfficers = (officers ?? []).filter((o) => o.active && o.roles.includes("RiskOfficer"));

  const handleConfirm = async () => {
    setError(null);
    if (!proposedByOfficerId || !confirmedByOfficerId) {
      setError("Both a proposing CreditOfficer and a confirming RiskOfficer are required (four-eyes)");
      return;
    }
    if (proposedByOfficerId === confirmedByOfficerId) {
      setError("Confirming officer must differ from proposing officer (four-eyes)");
      return;
    }
    if (!(approvedSettlementAmount > 0 && approvedSettlementAmount < request.outstandingBalance)) {
      setError("Approved settlement must be positive and less than the outstanding balance");
      return;
    }
    try {
      await grant.mutateAsync({ id: request.id, rebateAmount, approvedSettlementAmount, proposedByOfficerId, confirmedByOfficerId });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to grant the partial Ibra'");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Grant Partial Ibra&apos;</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Outstanding: {formatNaira(request.outstandingBalance)}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Rebate Amount (NGN)</label>
          <input type="number" className="input font-mono" value={rebateAmount} onChange={(e) => setRebateAmount(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Approved Settlement Amount (NGN)</label>
          <input type="number" className="input font-mono" value={approvedSettlementAmount} onChange={(e) => setApprovedSettlementAmount(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Proposed By (CreditOfficer)</label>
          <select className="input" value={proposedByOfficerId} onChange={(e) => setProposedByOfficerId(e.target.value)}>
            <option value="">Select an officer…</option>
            {creditOfficers.map((o) => (
              <option key={o.id} value={o.officer_id}>{o.officer_name} ({o.officer_id})</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Confirmed By (RiskOfficer, four-eyes)</label>
          <select className="input" value={confirmedByOfficerId} onChange={(e) => setConfirmedByOfficerId(e.target.value)}>
            <option value="">Select an officer…</option>
            {riskOfficers.map((o) => (
              <option key={o.id} value={o.officer_id}>{o.officer_name} ({o.officer_id})</option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleConfirm} disabled={grant.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {grant.isPending ? "Submitting…" : "Grant Partial Ibra'"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProposeRebateModal({ request, onClose }: { request: IbraRequestItem; onClose: () => void }) {
  const [suggestedRebate, setSuggestedRebate] = useState(0);
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | null>(null);
  const propose = useProposeRebate();

  const handleSubmit = async () => {
    setError(null);
    if (!(suggestedRebate >= 0) || suggestedRebate > request.outstandingBalance) {
      setError("Suggested rebate must be non-negative and cannot exceed the outstanding balance");
      return;
    }
    if (!rationale.trim()) {
      setError("Please provide a rationale");
      return;
    }
    try {
      await propose.mutateAsync({ id: request.id, suggestedRebate, rationale });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to propose the rebate");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Propose Rebate</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Outstanding: {formatNaira(request.outstandingBalance)}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Suggested Rebate (NGN)</label>
          <input type="number" className="input font-mono" value={suggestedRebate} onChange={(e) => setSuggestedRebate(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Rationale</label>
          <textarea rows={2} className="input text-sm resize-none" value={rationale} onChange={(e) => setRationale(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={propose.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {propose.isPending ? "Proposing…" : "Propose Rebate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTakafulPolicyModal({ contractId, onClose }: { contractId: string; onClose: () => void }) {
  const [policyNumber, setPolicyNumber] = useState(`TKF-${Date.now()}`);
  const [takafulOperator, setTakafulOperator] = useState("");
  const [coverageType, setCoverageType] = useState("");
  const [coverageAmount, setCoverageAmount] = useState(0);
  const [premiumAmount, setPremiumAmount] = useState(0);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState("");
  const [assetRef, setAssetRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateTakafulPolicy();

  const handleSubmit = async () => {
    setError(null);
    if (!policyNumber.trim() || !takafulOperator.trim() || !coverageType.trim() || !expiryDate) {
      setError("Policy number, operator, coverage type, and expiry date are required");
      return;
    }
    if (coverageAmount <= 0 || premiumAmount <= 0) {
      setError("Coverage and premium amounts must be positive");
      return;
    }
    if (!(new Date(expiryDate).getTime() > new Date(startDate).getTime())) {
      setError("Expiry date must be later than the start date");
      return;
    }
    try {
      await create.mutateAsync({ id: contractId, policyNumber, takafulOperator, coverageType, coverageAmount, premiumAmount, startDate, expiryDate, assetRef: assetRef || null });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the Takaful policy");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Create Takaful Policy</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Policy Number</label>
          <input className="input text-sm font-mono" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Takaful Operator</label>
          <input className="input text-sm" value={takafulOperator} onChange={(e) => setTakafulOperator(e.target.value)} placeholder="Noor Takaful" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Coverage Type</label>
          <input className="input text-sm" value={coverageType} onChange={(e) => setCoverageType(e.target.value)} placeholder="Asset damage / loss" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Coverage Amount (NGN)</label>
            <input type="number" className="input text-sm font-mono" value={coverageAmount} onChange={(e) => setCoverageAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Premium Amount (NGN)</label>
            <input type="number" className="input text-sm font-mono" value={premiumAmount} onChange={(e) => setPremiumAmount(Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" className="input text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date</label>
            <input type="date" className="input text-sm" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Asset Reference (optional)</label>
          <input className="input text-sm font-mono" value={assetRef} onChange={(e) => setAssetRef(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create Policy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CollateralActionModal({
  rahn,
  mode,
  onClose,
}: {
  rahn: RahnAgreementItem;
  mode: "release" | "enforce";
  onClose: () => void;
}) {
  const { data: officers } = useOfficers();
  const [text, setText] = useState("");
  const [proposedByOfficerId, setProposedByOfficerId] = useState("");
  const [confirmedByOfficerId, setConfirmedByOfficerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const release = useReleaseCollateral();
  const enforce = useEnforceCollateral();
  const isPending = release.isPending || enforce.isPending;

  const proposerRole = mode === "release" ? "OperationsOfficer" : "RecoveryOfficer";
  const proposers = (officers ?? []).filter((o) => o.active && o.roles.includes(proposerRole));
  const confirmers = (officers ?? []).filter((o) => o.active && o.roles.includes("RiskOfficer"));

  const handleConfirm = async () => {
    setError(null);
    if (!proposedByOfficerId || !confirmedByOfficerId) {
      setError(`Both a proposing ${proposerRole} and a confirming RiskOfficer are required (four-eyes)`);
      return;
    }
    if (proposedByOfficerId === confirmedByOfficerId) {
      setError("Confirming officer must differ from proposing officer (four-eyes)");
      return;
    }
    if (!text.trim()) {
      setError(mode === "release" ? "Please provide a note" : "Please provide a reason");
      return;
    }
    try {
      if (mode === "release") {
        await release.mutateAsync({ id: rahn.id, note: text, proposedByOfficerId, confirmedByOfficerId });
      } else {
        await enforce.mutateAsync({ id: rahn.id, reason: text, proposedByOfficerId, confirmedByOfficerId });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${mode} collateral`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{mode === "release" ? "Release Collateral" : "Enforce Collateral"}</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {rahn.collateralDescription} · {formatNaira(rahn.collateralValue)}
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">{mode === "release" ? "Note" : "Reason"}</label>
          <textarea rows={2} className="input resize-none" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Proposed By ({proposerRole})</label>
          <select className="input" value={proposedByOfficerId} onChange={(e) => setProposedByOfficerId(e.target.value)}>
            <option value="">Select an officer…</option>
            {proposers.map((o) => (
              <option key={o.id} value={o.officer_id}>
                {o.officer_name} ({o.officer_id})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Confirmed By (RiskOfficer, four-eyes)</label>
          <select className="input" value={confirmedByOfficerId} onChange={(e) => setConfirmedByOfficerId(e.target.value)}>
            <option value="">Select an officer…</option>
            {confirmers.map((o) => (
              <option key={o.id} value={o.officer_id}>
                {o.officer_name} ({o.officer_id})
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className={`flex-1 disabled:opacity-40 ${mode === "enforce" ? "btn-danger" : "btn-primary"}`}
          >
            {isPending ? "Submitting…" : mode === "release" ? "Release Collateral" : "Enforce Collateral"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Phase 2, Thirty-Seventh Slice: Revalue/RecordInspection/ProposeEnforceCollateral --
// same modal-over-backdrop shape as CollateralActionModal above, but each is
// its own single-purpose form (no four-eyes on Revalue/RecordInspection;
// ProposeEnforceCollateral needs only the proposing RecoveryOfficer -- the
// confirming RiskOfficer step happens later, by vetify, on ConfirmEnforce).

function RevalueModal({ rahn, onClose }: { rahn: RahnAgreementItem; onClose: () => void }) {
  const [newValue, setNewValue] = useState<number | "">("");
  const [valuationDate, setValuationDate] = useState("");
  const [valuatorRef, setValuatorRef] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const revalue = useRevalue();

  const handleSubmit = async () => {
    setError(null);
    if (!newValue || !valuationDate || !valuatorRef.trim()) {
      setError("New value, valuation date, and valuator reference are all required");
      return;
    }
    try {
      await revalue.mutateAsync({ id: rahn.id, newValue: Number(newValue), valuationDate, valuatorRef, notes: notes || null });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revalue collateral");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Revalue Collateral</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Current value: {formatNaira(rahn.collateralValue)}
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">New Value (NGN)</label>
          <input type="number" className="input text-sm font-mono" value={newValue} onChange={(e) => setNewValue(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Valuation Date</label>
          <input type="date" className="input text-sm" value={valuationDate} onChange={(e) => setValuationDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Valuator Reference</label>
          <input className="input text-sm" placeholder="Appraiser name or certification ref" value={valuatorRef} onChange={(e) => setValuatorRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea rows={2} className="input text-sm resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={revalue.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {revalue.isPending ? "Submitting…" : "Revalue"}
          </button>
        </div>
      </div>
    </div>
  );
}

const INSPECTION_CONDITIONS = ["Satisfactory", "RequiresAttention", "Impaired"] as const;

function RecordInspectionModal({ rahn, onClose }: { rahn: RahnAgreementItem; onClose: () => void }) {
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspectedBy, setInspectedBy] = useState("");
  const [condition, setCondition] = useState<(typeof INSPECTION_CONDITIONS)[number]>("Satisfactory");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [nextInspectionDate, setNextInspectionDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recordInspection = useRecordInspection();

  const handleSubmit = async () => {
    setError(null);
    if (!inspectionDate || !inspectedBy.trim()) {
      setError("Inspection date and inspected-by are both required");
      return;
    }
    try {
      await recordInspection.mutateAsync({
        id: rahn.id, inspectionDate, inspectedBy, condition,
        inspectionNotes: inspectionNotes || null, nextInspectionDate: nextInspectionDate || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record inspection");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Record Inspection</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{rahn.collateralDescription}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Inspection Date</label>
          <input type="date" className="input text-sm" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Inspected By</label>
          <input className="input text-sm" placeholder="Field officer or agency name" value={inspectedBy} onChange={(e) => setInspectedBy(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Condition</label>
          <select className="input text-sm" value={condition} onChange={(e) => setCondition(e.target.value as (typeof INSPECTION_CONDITIONS)[number])}>
            {INSPECTION_CONDITIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Next Inspection Date (optional)</label>
          <input type="date" className="input text-sm" value={nextInspectionDate} onChange={(e) => setNextInspectionDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea rows={2} className="input text-sm resize-none" value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={recordInspection.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {recordInspection.isPending ? "Submitting…" : "Record Inspection"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProposeEnforceModal({ rahn, onClose }: { rahn: RahnAgreementItem; onClose: () => void }) {
  const { data: officers } = useOfficers();
  const [reason, setReason] = useState("");
  const [gsmExhausted, setGsmExhausted] = useState(false);
  const [gsmRef, setGsmRef] = useState("");
  const [proposedByOfficerId, setProposedByOfficerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const propose = useProposeEnforceCollateral();

  const proposers = (officers ?? []).filter((o) => o.active && o.roles.includes("RecoveryOfficer"));

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim() || !proposedByOfficerId) {
      setError("A reason and a proposing RecoveryOfficer are both required");
      return;
    }
    try {
      await propose.mutateAsync({ id: rahn.id, reason, gsmExhausted, gsmRef: gsmRef || null, proposedByOfficerId });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to propose enforcement");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Propose Collateral Enforcement</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Sent to vetify for confirmation (maker-checker) — this does not enforce the collateral directly.
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
          <textarea rows={2} className="input text-sm resize-none" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="mb-3 flex items-center gap-2">
          <input id="gsmExhausted" type="checkbox" checked={gsmExhausted} onChange={(e) => setGsmExhausted(e.target.checked)} />
          <label htmlFor="gsmExhausted" className="text-xs text-gray-700">GSM sweeps attempted before Rahn escalation</label>
        </div>
        {gsmExhausted && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">GSM Reference (optional)</label>
            <input className="input text-sm" value={gsmRef} onChange={(e) => setGsmRef(e.target.value)} />
          </div>
        )}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Proposed By (RecoveryOfficer)</label>
          <select className="input text-sm" value={proposedByOfficerId} onChange={(e) => setProposedByOfficerId(e.target.value)}>
            <option value="">Select an officer…</option>
            {proposers.map((o) => (
              <option key={o.id} value={o.officer_id}>{o.officer_name} ({o.officer_id})</option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={propose.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {propose.isPending ? "Submitting…" : "Propose Enforcement"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Phase 2, Thirty-Eighth Slice: Collateral & Recovery, Pass 2 -- WriteOff
// (four-eyes, same checkFourEyes pattern CollateralActionModal already
// uses), EscalateToLegal, GuaranteeAgreement create, and its
// enforce/release action (mirrors CollateralActionModal's release/enforce
// shape, no four-eyes since EnforceGuarantee/ReleaseGuarantee are single-
// controller financialInstitution choices).

function WriteOffModal({ contractId, onClose }: { contractId: string; onClose: () => void }) {
  const { data: officers } = useOfficers();
  const [writeOffDate, setWriteOffDate] = useState(new Date().toISOString().slice(0, 10));
  const [writeOffRef, setWriteOffRef] = useState("");
  const [totalRecovered, setTotalRecovered] = useState<number | "">("");
  const [proposedByOfficerId, setProposedByOfficerId] = useState("");
  const [confirmedByOfficerId, setConfirmedByOfficerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const writeOffContract = useWriteOffContract();

  const proposers = (officers ?? []).filter((o) => o.active && o.roles.includes("RecoveryOfficer"));
  const confirmers = (officers ?? []).filter((o) => o.active && o.roles.includes("RiskOfficer"));
  const confirmerName = confirmers.find((o) => o.officer_id === confirmedByOfficerId)?.officer_name ?? "";

  const handleSubmit = async () => {
    setError(null);
    if (!writeOffRef.trim() || totalRecovered === "" || !proposedByOfficerId || !confirmedByOfficerId) {
      setError("Write-off reference, total recovered, and both officers are required");
      return;
    }
    try {
      await writeOffContract.mutateAsync({
        id: contractId, writeOffDate, writeOffRef, totalRecovered: Number(totalRecovered),
        writeOffApprovedBy: confirmerName, proposedByOfficerId, confirmedByOfficerId,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to write off the contract");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Write Off Contract</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Write-Off Date</label>
          <input type="date" className="input text-sm" value={writeOffDate} onChange={(e) => setWriteOffDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Write-Off Reference</label>
          <input className="input text-sm" value={writeOffRef} onChange={(e) => setWriteOffRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Total Recovered to Date (NGN)</label>
          <input type="number" className="input text-sm font-mono" value={totalRecovered} onChange={(e) => setTotalRecovered(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Proposed By (RecoveryOfficer)</label>
          <select className="input text-sm" value={proposedByOfficerId} onChange={(e) => setProposedByOfficerId(e.target.value)}>
            <option value="">Select an officer…</option>
            {proposers.map((o) => <option key={o.id} value={o.officer_id}>{o.officer_name} ({o.officer_id})</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Confirmed By (RiskOfficer, approves the write-off)</label>
          <select className="input text-sm" value={confirmedByOfficerId} onChange={(e) => setConfirmedByOfficerId(e.target.value)}>
            <option value="">Select an officer…</option>
            {confirmers.map((o) => <option key={o.id} value={o.officer_id}>{o.officer_name} ({o.officer_id})</option>)}
          </select>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={writeOffContract.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {writeOffContract.isPending ? "Submitting…" : "Write Off"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EscalateToLegalModal({ notice, onClose }: { notice: DemandNoticeItem; onClose: () => void }) {
  const [escalationDate, setEscalationDate] = useState(new Date().toISOString().slice(0, 10));
  const [solicitorRef, setSolicitorRef] = useState("");
  const [legalAction, setLegalAction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const escalateToLegal = useEscalateToLegal();

  const handleSubmit = async () => {
    setError(null);
    if (!solicitorRef.trim() || !legalAction.trim()) {
      setError("Solicitor reference and legal action are both required");
      return;
    }
    try {
      await escalateToLegal.mutateAsync({ id: notice.id, escalationDate, solicitorRef, legalAction });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to escalate to legal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Escalate to Legal</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{notice.demandRef} · {formatNaira(notice.outstandingAmount)}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Escalation Date</label>
          <input type="date" className="input text-sm" value={escalationDate} onChange={(e) => setEscalationDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Solicitor Reference</label>
          <input className="input text-sm" value={solicitorRef} onChange={(e) => setSolicitorRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Legal Action</label>
          <textarea rows={2} className="input text-sm resize-none" value={legalAction} onChange={(e) => setLegalAction(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={escalateToLegal.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {escalateToLegal.isPending ? "Submitting…" : "Escalate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateGuaranteeModal({ contractId, onClose }: { contractId: string; onClose: () => void }) {
  const [guaranteeType, setGuaranteeType] = useState("PERSONAL");
  const [guaranteedAmount, setGuaranteedAmount] = useState<number | "">("");
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorId, setGuarantorId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const create = useCreateGuaranteeAgreement();

  const handleSubmit = async () => {
    setError(null);
    if (!guaranteedAmount || !guarantorName.trim() || !guarantorId.trim()) {
      setError("Guaranteed amount, guarantor name, and guarantor ID are all required");
      return;
    }
    try {
      await create.mutateAsync({ id: contractId, guaranteeType, guaranteedAmount: Number(guaranteedAmount), guarantorName, guarantorId, effectiveDate });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create guarantee agreement");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Add Guarantee</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Guarantee Type</label>
          <select className="input text-sm" value={guaranteeType} onChange={(e) => setGuaranteeType(e.target.value)}>
            <option value="PERSONAL">Personal</option>
            <option value="CORPORATE">Corporate</option>
            <option value="THIRD_PARTY">Third Party</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Guaranteed Amount (NGN)</label>
          <input type="number" className="input text-sm font-mono" value={guaranteedAmount} onChange={(e) => setGuaranteedAmount(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Guarantor Name</label>
          <input className="input text-sm" value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Guarantor ID (NIN / RC / passport)</label>
          <input className="input text-sm" value={guarantorId} onChange={(e) => setGuarantorId(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Effective Date</label>
          <input type="date" className="input text-sm" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {create.isPending ? "Submitting…" : "Add Guarantee"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EnforceReleaseGuaranteeModal({
  guarantee, mode, onClose,
}: { guarantee: GuaranteeAgreementItem; mode: "enforce" | "release"; onClose: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const enforceGuarantee = useEnforceGuarantee();
  const releaseGuarantee = useReleaseGuarantee();
  const isPending = enforceGuarantee.isPending || releaseGuarantee.isPending;

  const handleSubmit = async () => {
    setError(null);
    if (!text.trim()) {
      setError(mode === "enforce" ? "Please provide a reason" : "Please provide a note");
      return;
    }
    try {
      if (mode === "enforce") await enforceGuarantee.mutateAsync({ id: guarantee.id, reason: text });
      else await releaseGuarantee.mutateAsync({ id: guarantee.id, note: text });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${mode} guarantee`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{mode === "enforce" ? "Enforce Guarantee" : "Release Guarantee"}</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{guarantee.guarantorName} · {formatNaira(guarantee.guaranteedAmount)}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">{mode === "enforce" ? "Reason" : "Note"}</label>
          <textarea rows={2} className="input text-sm resize-none" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending} className={`flex-1 disabled:opacity-40 ${mode === "enforce" ? "btn-danger" : "btn-primary"}`}>
            {isPending ? "Submitting…" : mode === "enforce" ? "Enforce" : "Release"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FiContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: contracts, isLoading } = useMurabahahContracts();
  const { data: repayments } = useRepaymentRecords(id);
  const { data: charities } = useLatePaymentCharities();
  const { data: ibraRequests } = useIbraRequests();
  const { data: rahnAgreements } = useRahnAgreements();
  const { data: valuationDocuments } = useCollateralValuationDocuments();
  const { data: valuationRecords } = useCollateralValuationRecords();
  const { data: inspectionRecords } = useCollateralInspectionRecords();
  const { data: pendingEnforcements } = usePendingCollateralEnforcements();
  const { data: restructuringRequests } = useRestructuringRequests();
  const { data: disputeRecords } = useDisputeRecords();
  const { data: arbitrationRequests } = useArbitrationRequests();
  const { data: mandates } = useDirectDebitMandates();
  const { data: collectionAttempts } = useDirectDebitCollectionAttempts();
  const { data: recoveryPayments } = useRecoveryPaymentRecords();
  const { data: gsmInvocations } = useGsmInvocations();
  const { data: hamishRecords } = useHamishJiddiyyah();
  const { data: demandNotices } = useDemandNotices();
  const { data: legalEscalations } = useLegalEscalations();
  const { data: guaranteeAgreements } = useGuaranteeAgreements();
  const { data: creditCovenants } = useCreditCovenants();
  const { data: takafulPolicies } = useTakafulPolicies();
  const recordPayment = useRecordPayment();
  const closeContract = useCloseContract();
  const setCharityAmount = useSetCharityAmount();
  const declineIbra = useDeclineIbra();
  const defaultContract = useDefaultContract();
  const closeDefaultedContract = useCloseDefaultedContract();
  const pledgeCollateral = usePledgeCollateral();
  const approveRestructuring = useApproveRestructuring();
  const rejectRestructuring = useRejectRestructuring();
  const createDirectDebitMandate = useCreateDirectDebitMandate();
  const suspendMandate = useSuspendMandate();
  const reinstateMandate = useReinstateMandate();
  const cancelMandate = useCancelMandate();
  const recordCollectionAttempt = useRecordCollectionAttempt();
  const recordRecoveryPayment = useRecordRecoveryPayment();
  const createGsmInvocation = useCreateGsmInvocation();
  const recordGsmSweep = useRecordGsmSweep();
  const cancelGsm = useCancelGsm();
  const grantMoratorium = useGrantMoratorium();
  const createHamishJiddiyyah = useCreateHamishJiddiyyah();
  const returnDeposit = useReturnDeposit();
  const forfeitDeposit = useForfeitDeposit();
  const writeOffContract = useWriteOffContract();
  const issueDemandNotice = useIssueDemandNotice();
  const withdrawDemand = useWithdrawDemand();
  const escalateToLegal = useEscalateToLegal();
  const recordCourtOrder = useRecordCourtOrder();
  const resolveLegal = useResolveLegal();
  const createGuaranteeAgreement = useCreateGuaranteeAgreement();
  const enforceGuarantee = useEnforceGuarantee();
  const releaseGuarantee = useReleaseGuarantee();
  const createCreditCovenant = useCreateCreditCovenant();

  const [amountPaid, setAmountPaid] = useState<number | "">("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [actionError, setActionError] = useState<string | null>(null);
  const [charityAmounts, setCharityAmounts] = useState<Record<string, number>>({});
  const [collateralModal, setCollateralModal] = useState<{ rahn: RahnAgreementItem; mode: "release" | "enforce" } | null>(null);
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralValue, setCollateralValue] = useState<number | "">("");
  const [revalueModalRahn, setRevalueModalRahn] = useState<RahnAgreementItem | null>(null);
  const [inspectionModalRahn, setInspectionModalRahn] = useState<RahnAgreementItem | null>(null);
  const [proposeEnforceModalRahn, setProposeEnforceModalRahn] = useState<RahnAgreementItem | null>(null);
  const [grantModalRequest, setGrantModalRequest] = useState<IbraRequestItem | null>(null);
  const [grantPartialModalRequest, setGrantPartialModalRequest] = useState<IbraRequestItem | null>(null);
  const [rebateModalRequest, setRebateModalRequest] = useState<IbraRequestItem | null>(null);
  const [takafulModalOpen, setTakafulModalOpen] = useState(false);
  const [defaultReason, setDefaultReason] = useState("");
  const [defaultedBy, setDefaultedBy] = useState("");
  const [restructRejectReasons, setRestructRejectReasons] = useState<Record<string, string>>({});
  const [mandateForm, setMandateForm] = useState({ monoMandateRef: "", accountRef: "", bankName: "", maxCollectionAmount: "" as number | "", gsmConsentGiven: false });
  const [mandateActionReason, setMandateActionReason] = useState("");
  const [attemptForm, setAttemptForm] = useState({
    monoCollectionRef: "",
    attemptedAmount: "" as number | "",
    succeeded: true,
    failureReason: "",
  });
  const [recoveryForm, setRecoveryForm] = useState({ amountRecovered: "" as number | "", recoverySource: RECOVERY_SOURCES[0].value });
  const [gsmForm, setGsmForm] = useState({ businessBvn: "", invokedAmount: "" as number | "", monoGsmRef: "" });
  const [gsmCancelReason, setGsmCancelReason] = useState("");
  const [sweepForm, setSweepForm] = useState({ sweepAmount: "" as number | "", nibssSweepRef: "" });
  const [moratoriumForm, setMoratoriumForm] = useState({ moratoriumEnd: "", reason: "" });
  const [hamishForm, setHamishForm] = useState({ depositAmount: "" as number | "", depositRef: "", returnDeadline: "" });
  const [hamishActionRef, setHamishActionRef] = useState("");
  const [forfeitForm, setForfeitForm] = useState({ actualLoss: "" as number | "", reason: "" });
  const [writeOffModalOpen, setWriteOffModalOpen] = useState(false);
  const [demandNoticeForm, setDemandNoticeForm] = useState({ demandDate: "", demandRef: "", responseDeadline: "", gsmEligible: false });
  const [escalateModalNotice, setEscalateModalNotice] = useState<DemandNoticeItem | null>(null);
  const [withdrawNoteByNotice, setWithdrawNoteByNotice] = useState<Record<string, string>>({});
  const [courtOrderRefByEscalation, setCourtOrderRefByEscalation] = useState<Record<string, string>>({});
  const [guaranteeModalOpen, setGuaranteeModalOpen] = useState(false);
  const [enforceReleaseModal, setEnforceReleaseModal] = useState<{ guarantee: GuaranteeAgreementItem; mode: "enforce" | "release" } | null>(null);
  const [covenantForm, setCovenantForm] = useState({ covenantType: "", threshold: "" as number | "", measurementFrequency: "MONTHLY" });

  if (isLoading) return <Layout breadcrumb={[{ label: "Contracts", path: "/fi/contracts" }, { label: "…" }]}><p className="text-sm text-gray-500">Loading…</p></Layout>;

  const contract = contracts?.find((c) => c.id === id);
  if (!contract) {
    return <Layout breadcrumb={[{ label: "Contracts", path: "/fi/contracts" }, { label: "Not Found" }]}><p className="text-sm text-red-600">Contract not found</p></Layout>;
  }

  const nextInstallmentNo = contract.installmentsPaid + 1;
  const canRecordPayment = contract.status === "Active" || contract.status === "Delinquent";
  const canClose = canRecordPayment && contract.outstandingBalance <= 0;
  const canDefault = contract.status === "Delinquent";
  const canCloseDefaulted = contract.status === "Defaulted" && contract.outstandingBalance <= 0;

  const contractCharities = (charities ?? []).filter((c) => c.murabahahContractId === contract.id);
  const contractIbraRequests = (ibraRequests ?? []).filter((r) => r.murabahahContractId === contract.id);
  const contractRahn = (rahnAgreements ?? []).find((r) => r.murabahahContractId === contract.id);
  const contractValuationDocs = (valuationDocuments ?? []).filter((d) => d.rahnAgreementId === contractRahn?.id);
  const contractValuationRecords = (valuationRecords ?? []).filter((r) => r.rahnAgreementId === contractRahn?.id);
  const contractInspectionRecords = (inspectionRecords ?? []).filter((r) => r.rahnAgreementId === contractRahn?.id);
  const contractPendingEnforcement = (pendingEnforcements ?? []).find((p) => p.rahnAgreementId === contractRahn?.id && p.status === "Pending");
  const contractRestructuringRequests = (restructuringRequests ?? []).filter((r) => r.murabahahContractId === contract.id);
  const contractDisputes = (disputeRecords ?? []).filter((d) => d.murabahahContractId === contract.id);
  const contractMandate = (mandates ?? []).find((m) => m.murabahahContractId === contract.id);
  const contractCollectionAttempts = (collectionAttempts ?? []).filter((a) => a.murabahahContractId === contract.id);
  const contractRecoveryPayments = (recoveryPayments ?? []).filter((r) => r.murabahahContractId === contract.id);
  const contractGsmInvocation = (gsmInvocations ?? []).find((g) => g.murabahahContractId === contract.id);
  const contractDemandNotices = (demandNotices ?? []).filter((d) => d.murabahahContractId === contract.id);
  const contractGuaranteeAgreements = (guaranteeAgreements ?? []).filter((g) => g.murabahahContractId === contract.id);
  const contractCreditCovenants = (creditCovenants ?? []).filter((c) => c.murabahahContractId === contract.id);
  const contractTakafulPolicies = (takafulPolicies ?? []).filter((t) => t.murabahahContractId === contract.id);
  const contractHamish = (hamishRecords ?? []).find((h) => h.murabahahContractId === contract.id);

  const handleGrantMoratorium = async () => {
    setActionError(null);
    if (!moratoriumForm.moratoriumEnd || !moratoriumForm.reason.trim()) {
      setActionError("Please provide a moratorium end date and reason");
      return;
    }
    try {
      await grantMoratorium.mutateAsync({ id: contract.id, moratoriumEnd: moratoriumForm.moratoriumEnd, reason: moratoriumForm.reason });
      setMoratoriumForm({ moratoriumEnd: "", reason: "" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to grant moratorium");
    }
  };

  const handleCreateHamish = async () => {
    setActionError(null);
    if (!hamishForm.depositAmount || hamishForm.depositAmount <= 0 || !hamishForm.depositRef.trim() || !hamishForm.returnDeadline) {
      setActionError("Please provide a positive deposit amount, a deposit reference, and a return deadline");
      return;
    }
    try {
      await createHamishJiddiyyah.mutateAsync({
        id: contract.id,
        depositAmount: Number(hamishForm.depositAmount),
        depositRef: hamishForm.depositRef,
        depositDate: new Date().toISOString().slice(0, 10),
        returnDeadline: hamishForm.returnDeadline,
      });
      setHamishForm({ depositAmount: "", depositRef: "", returnDeadline: "" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to record Hamish al-Jiddiyyah deposit");
    }
  };

  const handleReturnDeposit = async () => {
    setActionError(null);
    if (!contractHamish || !hamishActionRef.trim()) {
      setActionError("Please provide a transfer reference");
      return;
    }
    try {
      await returnDeposit.mutateAsync({ id: contractHamish.id, transferRef: hamishActionRef });
      setHamishActionRef("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to return deposit");
    }
  };

  const handleForfeitDeposit = async () => {
    setActionError(null);
    if (!contractHamish || !forfeitForm.actualLoss || forfeitForm.actualLoss <= 0 || !forfeitForm.reason.trim()) {
      setActionError("Please provide a positive actual loss amount and a reason");
      return;
    }
    try {
      await forfeitDeposit.mutateAsync({ id: contractHamish.id, actualLoss: Number(forfeitForm.actualLoss), reason: forfeitForm.reason });
      setForfeitForm({ actualLoss: "", reason: "" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to forfeit deposit");
    }
  };

  const handleCreateDirectDebitMandate = async () => {
    setActionError(null);
    if (!mandateForm.monoMandateRef.trim() || !mandateForm.accountRef.trim() || !mandateForm.maxCollectionAmount || mandateForm.maxCollectionAmount <= 0) {
      setActionError("Please provide a mandate reference, account reference, and a positive max collection amount");
      return;
    }
    try {
      await createDirectDebitMandate.mutateAsync({
        id: contract.id,
        monoMandateRef: mandateForm.monoMandateRef,
        accountRef: mandateForm.accountRef,
        bankName: mandateForm.bankName,
        maxCollectionAmount: Number(mandateForm.maxCollectionAmount),
        mandateStartDate: new Date().toISOString().slice(0, 10),
        gsmConsentGiven: mandateForm.gsmConsentGiven,
      });
      setMandateForm({ monoMandateRef: "", accountRef: "", bankName: "", maxCollectionAmount: "", gsmConsentGiven: false });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to create Direct Debit mandate");
    }
  };

  const handleSuspendMandate = async () => {
    setActionError(null);
    if (!contractMandate || !mandateActionReason.trim()) {
      setActionError("Please provide a reason");
      return;
    }
    try {
      await suspendMandate.mutateAsync({ id: contractMandate.id, reason: mandateActionReason });
      setMandateActionReason("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to suspend mandate");
    }
  };

  const handleReinstateMandate = async () => {
    setActionError(null);
    if (!contractMandate) return;
    try {
      await reinstateMandate.mutateAsync({ id: contractMandate.id });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to reinstate mandate");
    }
  };

  const handleCancelMandate = async () => {
    setActionError(null);
    if (!contractMandate || !mandateActionReason.trim()) {
      setActionError("Please provide a reason");
      return;
    }
    try {
      await cancelMandate.mutateAsync({ id: contractMandate.id, reason: mandateActionReason });
      setMandateActionReason("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to cancel mandate");
    }
  };

  const handleRecordCollectionAttempt = async () => {
    setActionError(null);
    if (!attemptForm.monoCollectionRef.trim() || !attemptForm.attemptedAmount || attemptForm.attemptedAmount <= 0) {
      setActionError("Please provide a mono.co collection reference and a positive amount");
      return;
    }
    try {
      await recordCollectionAttempt.mutateAsync({
        id: contract.id,
        monoCollectionRef: attemptForm.monoCollectionRef,
        installmentNo: nextInstallmentNo,
        attemptedAmount: Number(attemptForm.attemptedAmount),
        attemptDate: new Date().toISOString().slice(0, 10),
        succeeded: attemptForm.succeeded,
        failureReason: attemptForm.succeeded ? undefined : attemptForm.failureReason || undefined,
      });
      setAttemptForm({ monoCollectionRef: "", attemptedAmount: "", succeeded: true, failureReason: "" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to record collection attempt");
    }
  };

  const handleRecordRecoveryPayment = async () => {
    setActionError(null);
    if (!recoveryForm.amountRecovered || recoveryForm.amountRecovered <= 0) {
      setActionError("Please enter a positive recovery amount");
      return;
    }
    try {
      await recordRecoveryPayment.mutateAsync({
        id: contract.id,
        amountRecovered: Number(recoveryForm.amountRecovered),
        recoveryDate: new Date().toISOString().slice(0, 10),
        recoverySource: recoveryForm.recoverySource,
      });
      setRecoveryForm({ amountRecovered: "", recoverySource: RECOVERY_SOURCES[0].value });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to record recovery payment");
    }
  };

  const handleCreateGsmInvocation = async () => {
    setActionError(null);
    if (!gsmForm.businessBvn.trim() || !gsmForm.monoGsmRef.trim() || !gsmForm.invokedAmount || gsmForm.invokedAmount <= 0) {
      setActionError("Please provide the business BVN, a mono.co/NIBSS GSM reference, and a positive invoked amount");
      return;
    }
    try {
      await createGsmInvocation.mutateAsync({
        id: contract.id,
        businessBvn: gsmForm.businessBvn,
        invokedAmount: Number(gsmForm.invokedAmount),
        monoGsmRef: gsmForm.monoGsmRef,
      });
      setGsmForm({ businessBvn: "", invokedAmount: "", monoGsmRef: "" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to invoke GSM");
    }
  };

  const handleRecordGsmSweep = async () => {
    setActionError(null);
    if (!contractGsmInvocation || !sweepForm.nibssSweepRef.trim() || !sweepForm.sweepAmount || sweepForm.sweepAmount <= 0) {
      setActionError("Please provide a NIBSS sweep reference and a positive sweep amount");
      return;
    }
    try {
      await recordGsmSweep.mutateAsync({
        id: contractGsmInvocation.id,
        sweepAmount: Number(sweepForm.sweepAmount),
        sweepDate: new Date().toISOString().slice(0, 10),
        nibssSweepRef: sweepForm.nibssSweepRef,
      });
      setSweepForm({ sweepAmount: "", nibssSweepRef: "" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to record GSM sweep");
    }
  };

  const handleCancelGsm = async () => {
    setActionError(null);
    if (!contractGsmInvocation || !gsmCancelReason.trim()) {
      setActionError("Please provide a reason");
      return;
    }
    try {
      await cancelGsm.mutateAsync({ id: contractGsmInvocation.id, reason: gsmCancelReason });
      setGsmCancelReason("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to cancel GSM invocation");
    }
  };

  const handleApproveRestructuring = async (requestId: string, approvedSchedule: PaymentScheduleEntry[]) => {
    setActionError(null);
    try {
      await approveRestructuring.mutateAsync({ id: requestId, approvedSchedule });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to approve restructuring");
    }
  };

  const handleRejectRestructuring = async (requestId: string) => {
    setActionError(null);
    const reason = restructRejectReasons[requestId];
    if (!reason?.trim()) {
      setActionError("Please provide a rejection reason");
      return;
    }
    try {
      await rejectRestructuring.mutateAsync({ id: requestId, reason });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to reject restructuring");
    }
  };

  const handlePledgeCollateral = async () => {
    setActionError(null);
    if (!collateralDescription.trim() || !collateralValue || collateralValue <= 0) {
      setActionError("Please provide a description and a positive collateral value");
      return;
    }
    try {
      await pledgeCollateral.mutateAsync({ id: contract.id, collateralDescription, collateralValue: Number(collateralValue) });
      setCollateralDescription("");
      setCollateralValue("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to pledge collateral");
    }
  };

  const handleRecordPayment = async () => {
    setActionError(null);
    if (!amountPaid || amountPaid <= 0) {
      setActionError("Please enter a valid payment amount");
      return;
    }
    try {
      await recordPayment.mutateAsync({ id: contract.id, paymentDate, amountPaid: Number(amountPaid), installmentNo: nextInstallmentNo });
      setAmountPaid("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to record payment");
    }
  };

  const handleClose = async () => {
    setActionError(null);
    try {
      await closeContract.mutateAsync(contract.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to close contract");
    }
  };

  const handleSetCharityAmount = async (charityId: string) => {
    setActionError(null);
    const amount = charityAmounts[charityId];
    if (!amount || amount <= 0) {
      setActionError("Please enter a valid charity amount");
      return;
    }
    try {
      await setCharityAmount.mutateAsync({ id: charityId, amount });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to set charity amount");
    }
  };

  const handleDeclineIbra = async (requestId: string) => {
    setActionError(null);
    try {
      await declineIbra.mutateAsync({ id: requestId, reason: "Declined by financial institution" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to decline Ibra' request");
    }
  };

  const handleDefault = async () => {
    setActionError(null);
    if (!defaultReason.trim() || !defaultedBy.trim()) {
      setActionError("Please provide a reason and the officer's name");
      return;
    }
    try {
      await defaultContract.mutateAsync({ id: contract.id, reason: defaultReason, defaultedBy });
      setDefaultReason("");
      setDefaultedBy("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to default the contract");
    }
  };

  const handleCloseDefaulted = async () => {
    setActionError(null);
    try {
      await closeDefaultedContract.mutateAsync(contract.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to close the defaulted contract");
    }
  };

  const handleIssueDemandNotice = async () => {
    setActionError(null);
    if (!demandNoticeForm.demandDate || !demandNoticeForm.demandRef.trim() || !demandNoticeForm.responseDeadline) {
      setActionError("Demand date, reference, and response deadline are all required");
      return;
    }
    try {
      await issueDemandNotice.mutateAsync({ id: contract.id, ...demandNoticeForm });
      setDemandNoticeForm({ demandDate: "", demandRef: "", responseDeadline: "", gsmEligible: false });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to issue demand notice");
    }
  };

  const handleWithdrawDemand = async (noticeId: string) => {
    setActionError(null);
    const note = withdrawNoteByNotice[noticeId];
    if (!note?.trim()) {
      setActionError("Please provide a withdrawal note");
      return;
    }
    try {
      await withdrawDemand.mutateAsync({ id: noticeId, note });
      setWithdrawNoteByNotice((p) => ({ ...p, [noticeId]: "" }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to withdraw demand notice");
    }
  };

  const handleRecordCourtOrder = async (escalationId: string) => {
    setActionError(null);
    const courtOrderRef = courtOrderRefByEscalation[escalationId];
    if (!courtOrderRef?.trim()) {
      setActionError("Please provide a court order reference");
      return;
    }
    try {
      await recordCourtOrder.mutateAsync({ id: escalationId, courtOrderRef });
      setCourtOrderRefByEscalation((p) => ({ ...p, [escalationId]: "" }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to record court order");
    }
  };

  const handleResolveLegal = async (escalationId: string) => {
    setActionError(null);
    try {
      await resolveLegal.mutateAsync({ id: escalationId, note: "Resolved" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to resolve legal escalation");
    }
  };

  const handleCreateCreditCovenant = async () => {
    setActionError(null);
    if (!covenantForm.covenantType.trim() || !covenantForm.threshold) {
      setActionError("Covenant type and threshold are both required");
      return;
    }
    try {
      await createCreditCovenant.mutateAsync({
        id: contract.id, covenantType: covenantForm.covenantType,
        threshold: Number(covenantForm.threshold), measurementFrequency: covenantForm.measurementFrequency,
      });
      setCovenantForm({ covenantType: "", threshold: "", measurementFrequency: "MONTHLY" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to create credit covenant");
    }
  };

  return (
    <Layout breadcrumb={[{ label: "Contracts", path: "/fi/contracts" }, { label: contract.facilityRef }]}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-gray-900">{contract.businessName}</h2>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{contract.facilityRef}</p>
            </div>
            <StatusBadge status={contract.status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Outstanding Balance</p>
              <p className="text-lg font-mono font-semibold text-gray-900 mt-0.5">{formatNaira(contract.outstandingBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Sale Price</p>
              <p className="text-lg font-mono font-semibold text-gray-900 mt-0.5">{formatNaira(contract.murabahahTerms.salePrice)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Installments Paid</p>
              <p className="text-lg font-mono font-semibold text-gray-900 mt-0.5">
                {contract.installmentsPaid} / {contract.murabahahTerms.tenureMonths}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Monthly Installment</p>
              <p className="text-lg font-mono font-semibold text-gray-900 mt-0.5">{formatNaira(contract.murabahahTerms.installmentAmount)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
            Shariah certification: <span className="font-mono">{contract.shariahCertificationRef}</span> ({contract.shariahCertifiedBy})
          </p>
        </div>

        {canRecordPayment && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Record Payment (Installment {nextInstallmentNo})</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount Paid (NGN)</label>
                <input
                  type="number"
                  className="input font-mono"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={String(contract.murabahahTerms.installmentAmount)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                <input type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
            </div>
            {actionError && <p className="text-xs text-red-600 mb-3">{actionError}</p>}
            <div className="flex gap-3">
              <button onClick={handleRecordPayment} disabled={recordPayment.isPending} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
                {recordPayment.isPending ? "Recording…" : "Record Payment"}
              </button>
              {canClose && (
                <button onClick={handleClose} disabled={closeContract.isPending} className="btn-secondary text-sm px-4 py-2 disabled:opacity-40">
                  {closeContract.isPending ? "Closing…" : "Close Contract (Fully Repaid)"}
                </button>
              )}
            </div>
          </div>
        )}

        {canRecordPayment && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Payment Moratorium</h3>
            {contract.activeMoratorium ? (
              <p className="text-sm text-gray-700">
                Active until <span className="font-mono">{formatDate(contract.activeMoratorium)}</span> — payments made on or before this date won&apos;t be
                flagged late. Ended by vetify (Vetify Staff &rarr; Delinquency Monitoring).
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-3">Future payments made before the moratorium end date won&apos;t trigger the late-payment flag.</p>
                <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
                  <input type="date" className="input text-sm" value={moratoriumForm.moratoriumEnd} onChange={(e) => setMoratoriumForm((p) => ({ ...p, moratoriumEnd: e.target.value }))} />
                  <input
                    className="input text-sm"
                    placeholder="Reason"
                    value={moratoriumForm.reason}
                    onChange={(e) => setMoratoriumForm((p) => ({ ...p, reason: e.target.value }))}
                  />
                  <button onClick={handleGrantMoratorium} disabled={grantMoratorium.isPending} className="btn-secondary text-sm px-3 disabled:opacity-40">
                    {grantMoratorium.isPending ? "Granting…" : "Grant"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Hamish al-Jiddiyyah (Security Deposit)</h3>
          {!contractHamish ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <input
                  type="number"
                  className="input text-sm font-mono"
                  placeholder="Deposit amount (NGN)"
                  value={hamishForm.depositAmount}
                  onChange={(e) => setHamishForm((p) => ({ ...p, depositAmount: e.target.value === "" ? "" : Number(e.target.value) }))}
                />
                <input
                  className="input text-sm"
                  placeholder="Deposit reference"
                  value={hamishForm.depositRef}
                  onChange={(e) => setHamishForm((p) => ({ ...p, depositRef: e.target.value }))}
                />
                <input type="date" className="input text-sm" value={hamishForm.returnDeadline} onChange={(e) => setHamishForm((p) => ({ ...p, returnDeadline: e.target.value }))} />
              </div>
              <button onClick={handleCreateHamish} disabled={createHamishJiddiyyah.isPending} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
                {createHamishJiddiyyah.isPending ? "Recording…" : "Record Deposit"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-900">{formatNaira(contractHamish.depositAmount)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {contractHamish.depositRef} · Return deadline {formatDate(contractHamish.returnDeadline)}
                  </p>
                </div>
                {contractHamish.status === "HamishHeld" && <span className="text-xs text-amber-600 flex-shrink-0">Held</span>}
                {contractHamish.status === "HamishReturned" && <span className="text-xs text-emerald-600 flex-shrink-0">Returned</span>}
                {contractHamish.status === "HamishForfeited" && <span className="text-xs text-red-600 flex-shrink-0">Forfeited</span>}
              </div>
              {contractHamish.status === "HamishHeld" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input className="input text-xs" placeholder="Transfer reference" value={hamishActionRef} onChange={(e) => setHamishActionRef(e.target.value)} />
                    <button onClick={handleReturnDeposit} disabled={returnDeposit.isPending} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                      Return Deposit
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      type="number"
                      className="input text-xs font-mono"
                      placeholder="Actual loss (NGN)"
                      value={forfeitForm.actualLoss}
                      onChange={(e) => setForfeitForm((p) => ({ ...p, actualLoss: e.target.value === "" ? "" : Number(e.target.value) }))}
                    />
                    <input
                      className="input text-xs"
                      placeholder="Reason"
                      value={forfeitForm.reason}
                      onChange={(e) => setForfeitForm((p) => ({ ...p, reason: e.target.value }))}
                    />
                    <button onClick={handleForfeitDeposit} disabled={forfeitDeposit.isPending} className="btn-danger text-xs px-3 py-1.5 disabled:opacity-50">
                      Forfeit
                    </button>
                  </div>
                </div>
              )}
              {contractHamish.actualLossDeducted != null && (
                <p className="text-xs text-gray-400 mt-2">Actual loss deducted: {formatNaira(contractHamish.actualLossDeducted)}</p>
              )}
            </>
          )}
        </div>

        {canRecordPayment && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Direct Debit Mandate</h3>
            {!contractMandate ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    className="input text-sm"
                    placeholder="mono.co mandate reference"
                    value={mandateForm.monoMandateRef}
                    onChange={(e) => setMandateForm((p) => ({ ...p, monoMandateRef: e.target.value }))}
                  />
                  <input
                    className="input text-sm"
                    placeholder="Account reference (NUBAN)"
                    value={mandateForm.accountRef}
                    onChange={(e) => setMandateForm((p) => ({ ...p, accountRef: e.target.value }))}
                  />
                  <input
                    className="input text-sm"
                    placeholder="Bank name"
                    value={mandateForm.bankName}
                    onChange={(e) => setMandateForm((p) => ({ ...p, bankName: e.target.value }))}
                  />
                  <input
                    type="number"
                    className="input text-sm font-mono"
                    placeholder="Max collection amount (NGN)"
                    value={mandateForm.maxCollectionAmount}
                    onChange={(e) => setMandateForm((p) => ({ ...p, maxCollectionAmount: e.target.value === "" ? "" : Number(e.target.value) }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                  <input
                    type="checkbox"
                    checked={mandateForm.gsmConsentGiven}
                    onChange={(e) => setMandateForm((p) => ({ ...p, gsmConsentGiven: e.target.checked }))}
                  />
                  Business consents to cross-bank CBN/NIBSS GSM sweep
                </label>
                <button onClick={handleCreateDirectDebitMandate} disabled={createDirectDebitMandate.isPending} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
                  {createDirectDebitMandate.isPending ? "Creating…" : "Create Mandate"}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm text-gray-900">
                      {contractMandate.bankName} · {contractMandate.accountRef}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatNaira(contractMandate.maxCollectionAmount)} cap · {contractMandate.gsmConsentGiven ? "GSM consent given" : "No GSM consent"}
                    </p>
                  </div>
                  {contractMandate.status === "MandateActive" && <span className="text-xs text-emerald-600 flex-shrink-0">Active</span>}
                  {contractMandate.status === "MandateSuspended" && <span className="text-xs text-amber-600 flex-shrink-0">Suspended</span>}
                  {contractMandate.status === "MandateCancelled" && <span className="text-xs text-red-600 flex-shrink-0">Cancelled</span>}
                </div>
                {contractMandate.status !== "MandateCancelled" && (
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 mb-4">
                    <input
                      className="input text-xs"
                      placeholder="Reason"
                      value={mandateActionReason}
                      onChange={(e) => setMandateActionReason(e.target.value)}
                    />
                    {contractMandate.status === "MandateActive" && (
                      <button onClick={handleSuspendMandate} disabled={suspendMandate.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
                        Suspend
                      </button>
                    )}
                    {contractMandate.status === "MandateSuspended" && (
                      <button onClick={handleReinstateMandate} disabled={reinstateMandate.isPending} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                        Reinstate
                      </button>
                    )}
                    <button onClick={handleCancelMandate} disabled={cancelMandate.isPending} className="btn-danger text-xs px-3 py-1.5 disabled:opacity-50">
                      Cancel
                    </button>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Record Collection Attempt (Installment {nextInstallmentNo})</h4>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      className="input text-xs"
                      placeholder="mono.co collection reference"
                      value={attemptForm.monoCollectionRef}
                      onChange={(e) => setAttemptForm((p) => ({ ...p, monoCollectionRef: e.target.value }))}
                    />
                    <input
                      type="number"
                      className="input text-xs font-mono"
                      placeholder="Attempted amount (NGN)"
                      value={attemptForm.attemptedAmount}
                      onChange={(e) => setAttemptForm((p) => ({ ...p, attemptedAmount: e.target.value === "" ? "" : Number(e.target.value) }))}
                    />
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input type="radio" checked={attemptForm.succeeded} onChange={() => setAttemptForm((p) => ({ ...p, succeeded: true }))} />
                      Succeeded
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input type="radio" checked={!attemptForm.succeeded} onChange={() => setAttemptForm((p) => ({ ...p, succeeded: false }))} />
                      Failed
                    </label>
                    {!attemptForm.succeeded && (
                      <input
                        className="input text-xs flex-1"
                        placeholder="Failure reason (e.g. INSUFFICIENT_FUNDS)"
                        value={attemptForm.failureReason}
                        onChange={(e) => setAttemptForm((p) => ({ ...p, failureReason: e.target.value }))}
                      />
                    )}
                  </div>
                  <button onClick={handleRecordCollectionAttempt} disabled={recordCollectionAttempt.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
                    {recordCollectionAttempt.isPending ? "Recording…" : "Record Attempt"}
                  </button>

                  {contractCollectionAttempts.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {contractCollectionAttempts.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-gray-600">
                            #{a.installmentNo} · {formatDate(a.attemptDate)}
                            {a.failureReason && <span className="text-red-500"> — {a.failureReason}</span>}
                          </span>
                          <span className={`font-mono ${a.succeeded ? "text-emerald-600" : "text-red-500"}`}>
                            {formatNaira(a.attemptedAmount)} {a.succeeded ? "OK" : "FAILED"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {(canDefault || contract.status === "Defaulted") && (
          <div className="card p-6 border-red-100 bg-red-50/30">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">{canDefault ? "Default (Write-Off)" : "Recovery"}</h3>
            {canDefault && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input className="input text-sm" placeholder="Reason" value={defaultReason} onChange={(e) => setDefaultReason(e.target.value)} />
                <input className="input text-sm" placeholder="Defaulted by (officer name)" value={defaultedBy} onChange={(e) => setDefaultedBy(e.target.value)} />
              </div>
            )}
            {actionError && <p className="text-xs text-red-600 mb-3">{actionError}</p>}
            {canDefault ? (
              <button onClick={handleDefault} disabled={defaultContract.isPending} className="btn-danger text-sm px-4 py-2 disabled:opacity-40">
                {defaultContract.isPending ? "Recording…" : "Default Contract"}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {canCloseDefaulted && (
                  <button onClick={handleCloseDefaulted} disabled={closeDefaultedContract.isPending} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
                    {closeDefaultedContract.isPending ? "Closing…" : "Close Defaulted Contract (Fully Recovered)"}
                  </button>
                )}
                <button onClick={() => setWriteOffModalOpen(true)} className="btn-danger text-sm px-4 py-2">
                  Write Off Remaining Balance
                </button>
              </div>
            )}
          </div>
        )}

        {contract.status === "Defaulted" && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Recovery &amp; GSM (Global Standing Mandate)</h3>

            <div className="mb-4 pb-4 border-b border-gray-100">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Demand Notice &amp; Legal Escalation</h4>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <input type="date" className="input text-sm" value={demandNoticeForm.demandDate} onChange={(e) => setDemandNoticeForm((p) => ({ ...p, demandDate: e.target.value }))} />
                <input className="input text-sm" placeholder="Demand ref" value={demandNoticeForm.demandRef} onChange={(e) => setDemandNoticeForm((p) => ({ ...p, demandRef: e.target.value }))} />
                <input type="date" className="input text-sm" placeholder="Response deadline" value={demandNoticeForm.responseDeadline} onChange={(e) => setDemandNoticeForm((p) => ({ ...p, responseDeadline: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <input id="gsmEligibleDemand" type="checkbox" checked={demandNoticeForm.gsmEligible} onChange={(e) => setDemandNoticeForm((p) => ({ ...p, gsmEligible: e.target.checked }))} />
                <label htmlFor="gsmEligibleDemand" className="text-xs text-gray-700">Valid GSM consent exists</label>
              </div>
              <button onClick={handleIssueDemandNotice} disabled={issueDemandNotice.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">
                {issueDemandNotice.isPending ? "Issuing…" : "Issue Demand Notice"}
              </button>

              {contractDemandNotices.length > 0 && (
                <div className="mt-3 space-y-2">
                  {contractDemandNotices.map((notice) => {
                    const escalation = (legalEscalations ?? []).find((e) => e.demandNoticeId === notice.id);
                    return (
                      <div key={notice.id} className="rounded-lg border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-gray-700">
                            {notice.demandRef} · Due {formatDate(notice.responseDeadline)} · {formatNaira(notice.outstandingAmount)}
                          </span>
                          {notice.archivedAt ? (
                            <span className="text-gray-400">{notice.supersededByKind === "legal_escalation" ? "Escalated" : "Withdrawn"}</span>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => setEscalateModalNotice(notice)} className="btn-danger text-xs px-2 py-1">Escalate to Legal</button>
                            </div>
                          )}
                        </div>
                        {!notice.archivedAt && (
                          <div className="flex gap-2 mt-2">
                            <input
                              className="input text-xs flex-1"
                              placeholder="Withdrawal note"
                              value={withdrawNoteByNotice[notice.id] ?? ""}
                              onChange={(e) => setWithdrawNoteByNotice((p) => ({ ...p, [notice.id]: e.target.value }))}
                            />
                            <button onClick={() => handleWithdrawDemand(notice.id)} disabled={withdrawDemand.isPending} className="btn-secondary text-xs px-2 py-1 disabled:opacity-40">
                              Withdraw
                            </button>
                          </div>
                        )}
                        {escalation && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-600 mb-1">
                              Legal: {escalation.solicitorRef} · {escalation.legalAction}
                              {escalation.courtRef && <span> · Court ref: {escalation.courtRef}</span>}
                              {escalation.resolvedAt && <span className="text-emerald-600"> · Resolved</span>}
                            </p>
                            {!escalation.resolvedAt && (
                              <div className="flex gap-2">
                                <input
                                  className="input text-xs flex-1"
                                  placeholder="Court order ref"
                                  value={courtOrderRefByEscalation[escalation.id] ?? ""}
                                  onChange={(e) => setCourtOrderRefByEscalation((p) => ({ ...p, [escalation.id]: e.target.value }))}
                                />
                                <button onClick={() => handleRecordCourtOrder(escalation.id)} disabled={recordCourtOrder.isPending} className="btn-secondary text-xs px-2 py-1 disabled:opacity-40">
                                  Record Order
                                </button>
                                <button onClick={() => handleResolveLegal(escalation.id)} disabled={resolveLegal.isPending} className="btn-primary text-xs px-2 py-1 disabled:opacity-40">
                                  Resolve
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mb-4 pb-4 border-b border-gray-100">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Record Recovery Payment</h4>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  type="number"
                  className="input text-sm font-mono"
                  placeholder="Amount recovered (NGN)"
                  value={recoveryForm.amountRecovered}
                  onChange={(e) => setRecoveryForm((p) => ({ ...p, amountRecovered: e.target.value === "" ? "" : Number(e.target.value) }))}
                />
                <select className="input text-sm" value={recoveryForm.recoverySource} onChange={(e) => setRecoveryForm((p) => ({ ...p, recoverySource: e.target.value }))}>
                  {RECOVERY_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button onClick={handleRecordRecoveryPayment} disabled={recordRecoveryPayment.isPending} className="btn-primary text-sm px-3 disabled:opacity-40">
                  {recordRecoveryPayment.isPending ? "Recording…" : "Record"}
                </button>
              </div>
              {contractRecoveryPayments.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {contractRecoveryPayments.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-600">
                        {r.recoverySource} · {formatDate(r.recoveryDate)}
                      </span>
                      <span className="font-mono text-emerald-600">
                        {formatNaira(r.amountRecovered)} → {formatNaira(r.remainingBalance)} remaining
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!contractGsmInvocation ? (
              <>
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Invoke GSM</h4>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <input
                    className="input text-sm"
                    placeholder="Business BVN"
                    value={gsmForm.businessBvn}
                    onChange={(e) => setGsmForm((p) => ({ ...p, businessBvn: e.target.value }))}
                  />
                  <input
                    type="number"
                    className="input text-sm font-mono"
                    placeholder="Invoked amount (NGN)"
                    value={gsmForm.invokedAmount}
                    onChange={(e) => setGsmForm((p) => ({ ...p, invokedAmount: e.target.value === "" ? "" : Number(e.target.value) }))}
                  />
                  <input
                    className="input text-sm"
                    placeholder="mono.co/NIBSS GSM ref"
                    value={gsmForm.monoGsmRef}
                    onChange={(e) => setGsmForm((p) => ({ ...p, monoGsmRef: e.target.value }))}
                  />
                </div>
                <button onClick={handleCreateGsmInvocation} disabled={createGsmInvocation.isPending} className="btn-danger text-sm px-4 py-2 disabled:opacity-40">
                  {createGsmInvocation.isPending ? "Invoking…" : "Invoke GSM"}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm text-gray-900">GSM Invocation — {formatNaira(contractGsmInvocation.invokedAmount)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{contractGsmInvocation.monoGsmRef}</p>
                  </div>
                  {contractGsmInvocation.status === "GSMActive" && <span className="text-xs text-emerald-600 flex-shrink-0">Active</span>}
                  {contractGsmInvocation.status === "GSMSettled" && <span className="text-xs text-gray-500 flex-shrink-0">Settled</span>}
                  {contractGsmInvocation.status === "GSMCancelled" && <span className="text-xs text-red-600 flex-shrink-0">Cancelled</span>}
                </div>

                {contractGsmInvocation.status === "GSMActive" && (
                  <>
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-3">
                      <input
                        type="number"
                        className="input text-sm font-mono"
                        placeholder="Sweep amount (NGN)"
                        value={sweepForm.sweepAmount}
                        onChange={(e) => setSweepForm((p) => ({ ...p, sweepAmount: e.target.value === "" ? "" : Number(e.target.value) }))}
                      />
                      <input
                        className="input text-sm"
                        placeholder="NIBSS sweep reference"
                        value={sweepForm.nibssSweepRef}
                        onChange={(e) => setSweepForm((p) => ({ ...p, nibssSweepRef: e.target.value }))}
                      />
                      <button onClick={handleRecordGsmSweep} disabled={recordGsmSweep.isPending} className="btn-primary text-sm px-3 disabled:opacity-40">
                        {recordGsmSweep.isPending ? "Sweeping…" : "Record Sweep"}
                      </button>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input className="input text-xs" placeholder="Cancellation reason" value={gsmCancelReason} onChange={(e) => setGsmCancelReason(e.target.value)} />
                      <button onClick={handleCancelGsm} disabled={cancelGsm.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
                        Cancel GSM
                      </button>
                    </div>
                  </>
                )}

                {contractGsmInvocation.lastSweepRef && (
                  <p className="text-xs text-gray-400 mt-2">Last sweep: {contractGsmInvocation.lastSweepRef}</p>
                )}
              </>
            )}
          </div>
        )}

        {contractIbraRequests.length > 0 && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Ibra&apos; Requests (Early Settlement)</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {contractIbraRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm text-gray-900">{r.settlementType === "FullIbra" ? "Full settlement" : "Partial settlement"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatNaira(r.outstandingBalance)} outstanding · requested for {formatDate(r.requestedSettlementDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setRebateModalRequest(r)} className="btn-secondary text-xs px-3 py-1.5">
                      Propose Rebate
                    </button>
                    {/* GrantIbra only works on FullIbra, GrantPartialIbra only on PartialIbra --
                        both are server-enforced, mirrored here since the two choices aren't interchangeable. */}
                    {r.settlementType === "FullIbra" ? (
                      <button onClick={() => setGrantModalRequest(r)} className="btn-primary text-xs px-3 py-1.5">
                        Grant Ibra&apos;
                      </button>
                    ) : (
                      <button onClick={() => setGrantPartialModalRequest(r)} className="btn-primary text-xs px-3 py-1.5">
                        Grant Partial
                      </button>
                    )}
                    <button onClick={() => handleDeclineIbra(r.id)} disabled={declineIbra.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {contractRestructuringRequests.length > 0 && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Restructuring Requests</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {contractRestructuringRequests.map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div>
                      <p className="text-sm text-gray-900">{r.proposedSchedule.length} installments proposed</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>
                    </div>
                    <span className="text-xs font-mono text-gray-700 flex-shrink-0">{formatNaira(r.outstandingBalance)}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => handleApproveRestructuring(r.id, r.proposedSchedule)}
                      disabled={approveRestructuring.isPending}
                      className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      Approve As Proposed
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      className="input text-xs"
                      placeholder="Rejection reason"
                      onChange={(e) => setRestructRejectReasons((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    />
                    <button
                      onClick={() => handleRejectRestructuring(r.id)}
                      disabled={rejectRestructuring.isPending}
                      className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {contractDisputes.length > 0 && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Disputes</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Read-only here -- EscalateToArbitration/RecordArbitrationOutcome are vetify&apos;s authority (Vetify Staff &rarr; Dispute Resolution).
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {contractDisputes.map((d) => {
                const arbitration = (arbitrationRequests ?? []).find((a) => a.disputeRecordId === d.id);
                return (
                  <div key={d.id} className="p-4">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <p className="text-sm text-gray-900">{DISPUTE_TYPE_LABELS[d.disputeType] ?? d.disputeType}</p>
                      <p className="text-xs">
                        {!d.archived && <span className="text-amber-600">Open</span>}
                        {d.archived && !arbitration && <span className="text-gray-500">Escalated</span>}
                        {arbitration?.outcome && <span className="text-emerald-600">Resolved</span>}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{d.description}</p>

                    {arbitration && (
                      <p className="text-xs text-gray-400">
                        Arbitrator: {arbitration.arbitrator}
                        {arbitration.outcome && ` · Outcome: ${arbitration.outcome} — ${arbitration.resolution}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {contractCharities.length > 0 && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Late Payment Charity (Sadaqah)</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {contractCharities.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm text-gray-900">Installment #{c.installmentNo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.charityAmount != null ? formatNaira(c.charityAmount) : "Amount not yet set"} ·{" "}
                      {c.settled ? <span className="text-emerald-600">Settled</span> : <span className="text-amber-600">Unsettled</span>}
                    </p>
                  </div>
                  {!c.settled && c.charityAmount == null && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        className="input text-sm font-mono w-32"
                        placeholder="Amount"
                        onChange={(e) => setCharityAmounts((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                      />
                      <button onClick={() => handleSetCharityAmount(c.id)} disabled={setCharityAmount.isPending} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                        Set Amount
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Collateral (Rahn)</h3>
          {!contractRahn ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  className="input text-sm"
                  placeholder="Collateral description (e.g. Plot 14, Lekki Phase 1)"
                  value={collateralDescription}
                  onChange={(e) => setCollateralDescription(e.target.value)}
                />
                <input
                  type="number"
                  className="input text-sm font-mono"
                  placeholder="Estimated value (NGN)"
                  value={collateralValue}
                  onChange={(e) => setCollateralValue(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <button onClick={handlePledgeCollateral} disabled={pledgeCollateral.isPending} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
                {pledgeCollateral.isPending ? "Pledging…" : "Pledge Collateral"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-900">{contractRahn.collateralDescription}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatNaira(contractRahn.collateralValue)} ·{" "}
                    {contractRahn.collateralStatus === "CollateralActive" && <span className="text-emerald-600">Active</span>}
                    {contractRahn.collateralStatus === "CollateralReleased" && <span className="text-gray-500">Released</span>}
                    {contractRahn.collateralStatus === "CollateralEnforced" && <span className="text-red-600">Enforced</span>}
                  </p>
                </div>
                {contractRahn.collateralStatus === "CollateralActive" && (
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <button onClick={() => setRevalueModalRahn(contractRahn)} className="btn-secondary text-xs px-3 py-1.5">
                      Revalue
                    </button>
                    <button onClick={() => setInspectionModalRahn(contractRahn)} className="btn-secondary text-xs px-3 py-1.5">
                      Record Inspection
                    </button>
                    <button onClick={() => setCollateralModal({ rahn: contractRahn, mode: "release" })} className="btn-secondary text-xs px-3 py-1.5">
                      Release
                    </button>
                    <button onClick={() => setCollateralModal({ rahn: contractRahn, mode: "enforce" })} className="btn-danger text-xs px-3 py-1.5">
                      Enforce
                    </button>
                    {!contractPendingEnforcement && (
                      <button onClick={() => setProposeEnforceModalRahn(contractRahn)} className="btn-danger text-xs px-3 py-1.5">
                        Propose Enforcement
                      </button>
                    )}
                  </div>
                )}
              </div>

              {contractPendingEnforcement && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-700">Enforcement proposed, awaiting vetify confirmation</p>
                    <p className="text-xs text-amber-600 mt-1">{contractPendingEnforcement.reason}</p>
                  </div>
                </div>
              )}

              {contractValuationDocs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-700">Business-Submitted Valuation Documents</h4>
                  {contractValuationDocs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-700">
                        {d.valuatorRef} · {formatDate(d.valuationDate)}
                        {d.notes && <span className="text-gray-400"> — {d.notes}</span>}
                      </span>
                      <span className="font-mono text-gray-600">{formatNaira(d.valuationAmount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {contractValuationRecords.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-700">Formal Revaluation History</h4>
                  {contractValuationRecords.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-700">
                        {r.valuatorRef} · {formatDate(r.valuationDate)}
                        {r.notes && <span className="text-gray-400"> — {r.notes}</span>}
                      </span>
                      <span className="font-mono text-gray-600">
                        {formatNaira(r.previousValue)} → {formatNaira(r.valuationAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {contractInspectionRecords.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-700">Inspection History</h4>
                  {contractInspectionRecords.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-700">
                        {r.inspectedBy} · {formatDate(r.inspectionDate)}
                        {r.inspectionNotes && <span className="text-gray-400"> — {r.inspectionNotes}</span>}
                      </span>
                      <span
                        className={`font-medium ${
                          r.condition === "Satisfactory" ? "text-emerald-600" : r.condition === "RequiresAttention" ? "text-amber-600" : "text-red-600"
                        }`}
                      >
                        {r.condition}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Guarantees</h3>
            <button onClick={() => setGuaranteeModalOpen(true)} className="btn-secondary text-xs px-3 py-1.5">Add Guarantee</button>
          </div>
          {contractGuaranteeAgreements.length === 0 ? (
            <p className="text-xs text-gray-400">No guarantees on this facility</p>
          ) : (
            <div className="space-y-2">
              {contractGuaranteeAgreements.map((g) => (
                <div key={g.id} className="rounded-lg border border-gray-100 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-900">{g.guarantorName} <span className="text-xs text-gray-400">({g.guaranteeType})</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatNaira(g.guaranteedAmount)} ·{" "}
                      {g.guaranteeStatus === "GuaranteeActive" && <span className="text-emerald-600">Active</span>}
                      {g.guaranteeStatus === "GuaranteeReleased" && <span className="text-gray-500">Released</span>}
                      {g.guaranteeStatus === "GuaranteeEnforced" && <span className="text-red-600">Enforced</span>}
                    </p>
                  </div>
                  {g.guaranteeStatus === "GuaranteeActive" && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setEnforceReleaseModal({ guarantee: g, mode: "release" })} className="btn-secondary text-xs px-3 py-1.5">Release</button>
                      <button onClick={() => setEnforceReleaseModal({ guarantee: g, mode: "enforce" })} className="btn-danger text-xs px-3 py-1.5">Enforce</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Credit Covenants</h4>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <input className="input text-sm" placeholder="Covenant type (e.g. DSCR_MINIMUM)" value={covenantForm.covenantType} onChange={(e) => setCovenantForm((p) => ({ ...p, covenantType: e.target.value }))} />
              <input type="number" step="0.01" className="input text-sm font-mono" placeholder="Threshold" value={covenantForm.threshold} onChange={(e) => setCovenantForm((p) => ({ ...p, threshold: e.target.value === "" ? "" : Number(e.target.value) }))} />
              <select className="input text-sm" value={covenantForm.measurementFrequency} onChange={(e) => setCovenantForm((p) => ({ ...p, measurementFrequency: e.target.value }))}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUALLY">Annually</option>
              </select>
            </div>
            <button onClick={handleCreateCreditCovenant} disabled={createCreditCovenant.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">
              {createCreditCovenant.isPending ? "Adding…" : "Add Covenant"}
            </button>
            {contractCreditCovenants.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {contractCreditCovenants.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-gray-700">{c.covenantType} · {c.measurementFrequency}</span>
                    <span className="font-mono text-gray-600">Threshold: {c.threshold}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">Measurements are recorded by vetify's portfolio-monitoring team, not the FI.</p>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Takaful Policies</h3>
            <button onClick={() => setTakafulModalOpen(true)} className="btn-secondary text-xs px-3 py-1.5">
              Add Policy
            </button>
          </div>
          {contractTakafulPolicies.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-400">No Takaful policies on this facility</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {contractTakafulPolicies.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 font-mono">{t.policyNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.takafulOperator} · {t.coverageType} · {formatDate(t.startDate)} – {formatDate(t.expiryDate)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono text-gray-900">{formatNaira(t.coverageAmount)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Premium: {formatNaira(t.premiumAmount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Repayment History</h3>
          </div>
          {!repayments || repayments.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-400">No repayments recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Installment</th>
                    <th>Due Date</th>
                    <th>Payment Date</th>
                    <th>Amount Paid</th>
                    <th>Remaining Balance</th>
                    <th>Late</th>
                  </tr>
                </thead>
                <tbody>
                  {repayments.map((r) => (
                    <tr key={r.id}>
                      <td className="text-xs text-gray-900">#{r.installmentNo}</td>
                      <td className="text-xs text-gray-600">{formatDate(r.dueDate)}</td>
                      <td className="text-xs text-gray-600">{formatDate(r.paymentDate)}</td>
                      <td className="text-xs font-mono text-gray-700">{formatNaira(r.amountPaid)}</td>
                      <td className="text-xs font-mono text-gray-700">{formatNaira(r.remainingBalance)}</td>
                      <td className="text-xs">
                        {r.wasLate ? <span className="text-amber-600 font-medium">Late</span> : <span className="text-gray-400">On time</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {grantModalRequest && <GrantIbraModal request={grantModalRequest} onClose={() => setGrantModalRequest(null)} />}
      {grantPartialModalRequest && <GrantPartialIbraModal request={grantPartialModalRequest} onClose={() => setGrantPartialModalRequest(null)} />}
      {rebateModalRequest && <ProposeRebateModal request={rebateModalRequest} onClose={() => setRebateModalRequest(null)} />}
      {takafulModalOpen && <CreateTakafulPolicyModal contractId={contract.id} onClose={() => setTakafulModalOpen(false)} />}
      {collateralModal && (
        <CollateralActionModal rahn={collateralModal.rahn} mode={collateralModal.mode} onClose={() => setCollateralModal(null)} />
      )}
      {revalueModalRahn && <RevalueModal rahn={revalueModalRahn} onClose={() => setRevalueModalRahn(null)} />}
      {inspectionModalRahn && <RecordInspectionModal rahn={inspectionModalRahn} onClose={() => setInspectionModalRahn(null)} />}
      {proposeEnforceModalRahn && <ProposeEnforceModal rahn={proposeEnforceModalRahn} onClose={() => setProposeEnforceModalRahn(null)} />}
      {writeOffModalOpen && <WriteOffModal contractId={contract.id} onClose={() => setWriteOffModalOpen(false)} />}
      {escalateModalNotice && <EscalateToLegalModal notice={escalateModalNotice} onClose={() => setEscalateModalNotice(null)} />}
      {guaranteeModalOpen && <CreateGuaranteeModal contractId={contract.id} onClose={() => setGuaranteeModalOpen(false)} />}
      {enforceReleaseModal && (
        <EnforceReleaseGuaranteeModal guarantee={enforceReleaseModal.guarantee} mode={enforceReleaseModal.mode} onClose={() => setEnforceReleaseModal(null)} />
      )}
    </Layout>
  );
}
