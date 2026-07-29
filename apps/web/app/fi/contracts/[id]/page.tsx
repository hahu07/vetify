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
  useOfficers,
  useDefaultContract,
  useCloseDefaultedContract,
  useRahnAgreements,
  usePledgeCollateral,
  useReleaseCollateral,
  useEnforceCollateral,
  useCollateralValuationDocuments,
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
  type IbraRequestItem,
  type RahnAgreementItem,
  type PaymentScheduleEntry,
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

export default function FiContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: contracts, isLoading } = useMurabahahContracts();
  const { data: repayments } = useRepaymentRecords(id);
  const { data: charities } = useLatePaymentCharities();
  const { data: ibraRequests } = useIbraRequests();
  const { data: rahnAgreements } = useRahnAgreements();
  const { data: valuationDocuments } = useCollateralValuationDocuments();
  const { data: restructuringRequests } = useRestructuringRequests();
  const { data: disputeRecords } = useDisputeRecords();
  const { data: arbitrationRequests } = useArbitrationRequests();
  const { data: mandates } = useDirectDebitMandates();
  const { data: collectionAttempts } = useDirectDebitCollectionAttempts();
  const { data: recoveryPayments } = useRecoveryPaymentRecords();
  const { data: gsmInvocations } = useGsmInvocations();
  const { data: hamishRecords } = useHamishJiddiyyah();
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

  const [amountPaid, setAmountPaid] = useState<number | "">("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [actionError, setActionError] = useState<string | null>(null);
  const [charityAmounts, setCharityAmounts] = useState<Record<string, number>>({});
  const [collateralModal, setCollateralModal] = useState<{ rahn: RahnAgreementItem; mode: "release" | "enforce" } | null>(null);
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralValue, setCollateralValue] = useState<number | "">("");
  const [grantModalRequest, setGrantModalRequest] = useState<IbraRequestItem | null>(null);
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
  const contractRestructuringRequests = (restructuringRequests ?? []).filter((r) => r.murabahahContractId === contract.id);
  const contractDisputes = (disputeRecords ?? []).filter((d) => d.murabahahContractId === contract.id);
  const contractMandate = (mandates ?? []).find((m) => m.murabahahContractId === contract.id);
  const contractCollectionAttempts = (collectionAttempts ?? []).filter((a) => a.murabahahContractId === contract.id);
  const contractRecoveryPayments = (recoveryPayments ?? []).filter((r) => r.murabahahContractId === contract.id);
  const contractGsmInvocation = (gsmInvocations ?? []).find((g) => g.murabahahContractId === contract.id);
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

        {(canDefault || canCloseDefaulted) && (
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
              <button onClick={handleCloseDefaulted} disabled={closeDefaultedContract.isPending} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
                {closeDefaultedContract.isPending ? "Closing…" : "Close Defaulted Contract (Fully Recovered)"}
              </button>
            )}
          </div>
        )}

        {contract.status === "Defaulted" && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Recovery &amp; GSM (Global Standing Mandate)</h3>

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
                    <button onClick={() => setGrantModalRequest(r)} className="btn-primary text-xs px-3 py-1.5">
                      Grant Ibra&apos;
                    </button>
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setCollateralModal({ rahn: contractRahn, mode: "release" })} className="btn-secondary text-xs px-3 py-1.5">
                      Release
                    </button>
                    <button onClick={() => setCollateralModal({ rahn: contractRahn, mode: "enforce" })} className="btn-danger text-xs px-3 py-1.5">
                      Enforce
                    </button>
                  </div>
                )}
              </div>

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
            </>
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
      {collateralModal && (
        <CollateralActionModal rahn={collateralModal.rahn} mode={collateralModal.mode} onClose={() => setCollateralModal(null)} />
      )}
    </Layout>
  );
}
