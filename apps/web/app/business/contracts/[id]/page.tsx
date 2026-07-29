"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Upload, FileText, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { formatNaira, formatDate } from "@/lib/formatters";
import { hashFile, MAX_DOCUMENT_BYTES } from "@/lib/fileHash";
import {
  useMurabahahContracts,
  useRepaymentRecords,
  useLatePaymentCharities,
  useConfirmCharityPayment,
  useIbraRequests,
  useRequestIbra,
  useRahnAgreements,
  useCollateralValuationDocuments,
  useSubmitCollateralValuation,
  useRestructuringRequests,
  useRequestRestructuring,
  useDisputeRecords,
  useRaiseDispute,
  useArbitrationRequests,
  type RahnAgreementItem,
  type PaymentScheduleEntry,
} from "@/lib/apiClient";

// Read-only-plus-two-actions counterpart to app/fi/contracts/[id]/page.tsx --
// same data, but adds the business's own two choices in this slice:
// RequestIbra (early settlement) and ConfirmCharityPayment (Sadaqah
// donation confirmation). No RecordPayment/CloseContract/GrantIbra/
// DefaultContract/collateral actions -- all FI-only choices; collateral
// status is shown read-only (Phase 2, sixth slice).
//
// Phase 2, seventh slice adds a business-submitted valuation document upload
// (an independent professional valuer's report, not a formal FI revaluation
// -- see migrations/012_collateral_valuation_document.sql's header).
//
// Phase 2, eighth slice adds RequestRestructuring and RaiseDispute -- see
// migrations/013_murabahah_restructuring_disputes.sql's header for scope.

// Spreads the outstanding balance evenly across `count` monthly
// installments starting the month after `requestDate`, with the last entry
// taking the rounding remainder so the total exactly equals the balance --
// a simple, deterministic schedule builder rather than a full editable
// per-installment grid, since the FI can still adjust the schedule on
// ApproveRestructuring.
function buildEvenSchedule(outstandingBalance: number, count: number, requestDate: string): PaymentScheduleEntry[] {
  const base = Math.floor((outstandingBalance / count) * 100) / 100;
  const entries: PaymentScheduleEntry[] = [];
  let allocated = 0;
  const start = new Date(requestDate);
  for (let i = 1; i <= count; i++) {
    const due = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
    const dueAmount = i === count ? Math.round((outstandingBalance - allocated) * 100) / 100 : base;
    allocated += dueAmount;
    entries.push({ installmentNo: i, dueDate: due.toISOString().slice(0, 10), dueAmount });
  }
  return entries;
}

const DISPUTE_TYPES: { value: string; label: string }[] = [
  { value: "PaymentDispute", label: "Payment Dispute" },
  { value: "ContractTermsDispute", label: "Contract Terms Dispute" },
  { value: "AssetDefectDispute", label: "Asset Defect Dispute" },
];

function CollateralValuationUpload({ rahn }: { rahn: RahnAgreementItem }) {
  const submit = useSubmitCollateralValuation();
  const [valuatorRef, setValuatorRef] = useState("");
  const [valuationAmount, setValuationAmount] = useState<number | "">("");
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<{ docType: string; contentHash: string; storageRef: string; fileSize: number } | null>(null);
  const [hashing, setHashing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (f.size > MAX_DOCUMENT_BYTES) {
      setError("File exceeds the 1MB limit.");
      return;
    }
    setHashing(true);
    try {
      const contentHash = await hashFile(f);
      setFile({ docType: "CollateralValuationReport", contentHash, storageRef: `local://${f.name}`, fileSize: f.size });
    } finally {
      setHashing(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!valuatorRef.trim() || !valuationAmount || valuationAmount <= 0 || !file) {
      setError("Please provide the valuer's reference, a positive valuation amount, and the valuation document.");
      return;
    }
    try {
      await submit.mutateAsync({
        id: rahn.id,
        valuatorRef,
        valuationAmount: Number(valuationAmount),
        valuationDate,
        notes: notes || undefined,
        docType: file.docType,
        contentHash: file.contentHash,
        storageRef: file.storageRef,
        fileSize: file.fileSize,
      });
      setValuatorRef("");
      setValuationAmount("");
      setNotes("");
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit valuation document");
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">Submit Professional Valuation Document</h4>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          className="input text-sm"
          placeholder="Valuer name / reference"
          value={valuatorRef}
          onChange={(e) => setValuatorRef(e.target.value)}
        />
        <input
          type="number"
          className="input text-sm font-mono"
          placeholder="Valuation amount (NGN)"
          value={valuationAmount}
          onChange={(e) => setValuationAmount(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <input type="date" className="input text-sm" value={valuationDate} onChange={(e) => setValuationDate(e.target.value)} />
        <input className="input text-sm" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-surface px-3 py-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={14} className="text-primary flex-shrink-0" />
            <p className="text-xs text-gray-700 truncate">{file.storageRef.split("/").pop()}</p>
          </div>
          <button type="button" onClick={() => setFile(null)} className="text-xs text-gray-400 hover:text-red-600">
            Remove
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-3 py-3 cursor-pointer text-center hover:border-primary/50 hover:bg-primary-50/30 mb-2">
          {hashing ? <Loader2 size={14} className="animate-spin text-primary" /> : <Upload size={14} className="text-gray-400" />}
          <span className="text-xs text-gray-600">{hashing ? "Processing…" : "Click to upload valuation report (PDF, max 1MB)"}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={hashing} onChange={(e) => handleFileSelect(e.target.files?.[0])} />
        </label>
      )}
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <button onClick={handleSubmit} disabled={submit.isPending} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
        {submit.isPending ? "Submitting…" : "Submit Valuation"}
      </button>
    </div>
  );
}

export default function BusinessContractDetailPage() {
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
  const confirmCharityPayment = useConfirmCharityPayment();
  const requestIbra = useRequestIbra();
  const requestRestructuring = useRequestRestructuring();
  const raiseDispute = useRaiseDispute();

  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().slice(0, 10));
  const [charityRefs, setCharityRefs] = useState<Record<string, { ref: string; org: string }>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [restructReason, setRestructReason] = useState("");
  const [restructInstallments, setRestructInstallments] = useState<number | "">("");
  const [restructDate, setRestructDate] = useState(new Date().toISOString().slice(0, 10));
  const [disputeType, setDisputeType] = useState(DISPUTE_TYPES[0].value);
  const [disputeDesc, setDisputeDesc] = useState("");
  const [disputeEvidenceRef, setDisputeEvidenceRef] = useState("");

  if (isLoading) return <Layout breadcrumb={[{ label: "My Contracts", path: "/business/contracts" }, { label: "…" }]}><p className="text-sm text-gray-500">Loading…</p></Layout>;

  const contract = contracts?.find((c) => c.id === id);
  if (!contract) {
    return <Layout breadcrumb={[{ label: "My Contracts", path: "/business/contracts" }, { label: "Not Found" }]}><p className="text-sm text-red-600">Contract not found</p></Layout>;
  }

  const contractCharities = (charities ?? []).filter((c) => c.murabahahContractId === contract.id);
  const contractIbraRequests = (ibraRequests ?? []).filter((r) => r.murabahahContractId === contract.id);
  const canRequestIbra = contract.status === "Active" && contractIbraRequests.length === 0;
  const contractRahn = (rahnAgreements ?? []).find((r) => r.murabahahContractId === contract.id);
  const contractValuationDocs = (valuationDocuments ?? []).filter((d) => d.rahnAgreementId === contractRahn?.id);
  const contractRestructuringRequests = (restructuringRequests ?? []).filter((r) => r.murabahahContractId === contract.id);
  const canRequestRestructuring = (contract.status === "Active" || contract.status === "Delinquent") && contractRestructuringRequests.length === 0;
  const contractDisputes = (disputeRecords ?? []).filter((d) => d.murabahahContractId === contract.id);

  const handleRequestIbra = async () => {
    setActionError(null);
    try {
      await requestIbra.mutateAsync({ id: contract.id, requestedSettlementDate: settlementDate, settlementType: "FullIbra" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to request Ibra'");
    }
  };

  const handleConfirmCharityPayment = async (charityId: string) => {
    setActionError(null);
    const entry = charityRefs[charityId];
    if (!entry?.ref || !entry?.org) {
      setActionError("Please provide both a receipt reference and the beneficiary organization");
      return;
    }
    try {
      await confirmCharityPayment.mutateAsync({ id: charityId, charityRef: entry.ref, charityOrganization: entry.org });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to confirm charity payment");
    }
  };

  const handleRequestRestructuring = async () => {
    setActionError(null);
    if (!restructReason.trim() || !restructInstallments || restructInstallments <= 0) {
      setActionError("Please provide a reason and a positive number of installments");
      return;
    }
    try {
      const proposedSchedule = buildEvenSchedule(contract.outstandingBalance, Number(restructInstallments), restructDate);
      await requestRestructuring.mutateAsync({ id: contract.id, proposedSchedule, reason: restructReason, requestDate: restructDate });
      setRestructReason("");
      setRestructInstallments("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to request restructuring");
    }
  };

  const handleRaiseDispute = async () => {
    setActionError(null);
    if (!disputeDesc.trim()) {
      setActionError("Please describe the dispute");
      return;
    }
    try {
      await raiseDispute.mutateAsync({ id: contract.id, disputeType, disputeDesc, evidenceRef: disputeEvidenceRef || undefined });
      setDisputeDesc("");
      setDisputeEvidenceRef("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to raise dispute");
    }
  };

  return (
    <Layout breadcrumb={[{ label: "My Contracts", path: "/business/contracts" }, { label: contract.facilityRef }]}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-gray-900">{contract.facilityRef}</h2>
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

        {actionError && <p className="text-xs text-red-600">{actionError}</p>}

        {canRequestIbra && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Request Early Settlement (Ibra&apos;)</h3>
            <p className="text-xs text-gray-500 mb-4">
              A voluntary rebate is entirely at the financial institution&apos;s discretion (AAOIFI Std No. 8, §6/1) -- it may grant, partially grant, or decline.
            </p>
            <div className="flex items-center gap-3">
              <input type="date" className="input text-sm" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
              <button onClick={handleRequestIbra} disabled={requestIbra.isPending} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
                {requestIbra.isPending ? "Requesting…" : "Request Full Settlement"}
              </button>
            </div>
          </div>
        )}

        {contractIbraRequests.length > 0 && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Ibra&apos; Request Pending</h3>
            <p className="text-xs text-gray-500">Awaiting the financial institution&apos;s decision on your early settlement request.</p>
          </div>
        )}

        {canRequestRestructuring && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Request Restructuring</h3>
            <p className="text-xs text-gray-500 mb-4">
              Propose a new repayment schedule spread evenly across a new number of installments -- the financial institution reviews and may adjust it on approval.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                type="number"
                className="input text-sm font-mono"
                placeholder="New number of installments"
                value={restructInstallments}
                onChange={(e) => setRestructInstallments(e.target.value === "" ? "" : Number(e.target.value))}
              />
              <input type="date" className="input text-sm" value={restructDate} onChange={(e) => setRestructDate(e.target.value)} />
            </div>
            <textarea
              rows={2}
              className="input text-sm resize-none mb-3"
              placeholder="Reason for requesting restructuring"
              value={restructReason}
              onChange={(e) => setRestructReason(e.target.value)}
            />
            <button onClick={handleRequestRestructuring} disabled={requestRestructuring.isPending} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
              {requestRestructuring.isPending ? "Requesting…" : "Request Restructuring"}
            </button>
          </div>
        )}

        {contractRestructuringRequests.length > 0 && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Restructuring Request Pending</h3>
            <p className="text-xs text-gray-500">
              {contractRestructuringRequests[0].proposedSchedule.length} installments proposed -- awaiting the financial institution&apos;s decision.
            </p>
          </div>
        )}

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Raise a Dispute</h3>
          <p className="text-xs text-gray-500 mb-4">Formally dispute an action the financial institution has taken on this facility.</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <select className="input text-sm" value={disputeType} onChange={(e) => setDisputeType(e.target.value)}>
              {DISPUTE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              className="input text-sm"
              placeholder="Evidence reference (optional)"
              value={disputeEvidenceRef}
              onChange={(e) => setDisputeEvidenceRef(e.target.value)}
            />
          </div>
          <textarea
            rows={3}
            className="input text-sm resize-none mb-3"
            placeholder="Describe the dispute"
            value={disputeDesc}
            onChange={(e) => setDisputeDesc(e.target.value)}
          />
          <button onClick={handleRaiseDispute} disabled={raiseDispute.isPending} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
            {raiseDispute.isPending ? "Raising…" : "Raise Dispute"}
          </button>
        </div>

        {contractDisputes.length > 0 && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Your Disputes</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {contractDisputes.map((d) => {
                const arbitration = (arbitrationRequests ?? []).find((a) => a.disputeRecordId === d.id);
                return (
                  <div key={d.id} className="p-4">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <p className="text-sm text-gray-900">{DISPUTE_TYPES.find((t) => t.value === d.disputeType)?.label ?? d.disputeType}</p>
                      <p className="text-xs">
                        {!d.archived && <span className="text-amber-600">Open</span>}
                        {d.archived && !arbitration && <span className="text-gray-500">Escalated</span>}
                        {arbitration?.outcome && <span className="text-emerald-600">Resolved</span>}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">{d.description}</p>
                    {arbitration && (
                      <p className="text-xs text-gray-400 mt-1">
                        Arbitrator: {arbitration.arbitrator}
                        {arbitration.outcome && ` · Outcome: ${arbitration.outcome}`}
                        {arbitration.resolution && ` — ${arbitration.resolution}`}
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
                <div key={c.id} className="p-4">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <p className="text-sm text-gray-900">Installment #{c.installmentNo}</p>
                    <p className="text-xs">
                      {c.charityAmount != null ? formatNaira(c.charityAmount) : "Amount not yet set"} ·{" "}
                      {c.settled ? <span className="text-emerald-600">Settled</span> : <span className="text-amber-600">Unsettled</span>}
                    </p>
                  </div>
                  {!c.settled && c.charityAmount != null && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input text-sm"
                        placeholder="Receipt reference"
                        onChange={(e) => setCharityRefs((prev) => ({ ...prev, [c.id]: { ref: e.target.value, org: prev[c.id]?.org ?? "" } }))}
                      />
                      <input
                        className="input text-sm"
                        placeholder="Beneficiary organization"
                        onChange={(e) => setCharityRefs((prev) => ({ ...prev, [c.id]: { ref: prev[c.id]?.ref ?? "", org: e.target.value } }))}
                      />
                      <button
                        onClick={() => handleConfirmCharityPayment(c.id)}
                        disabled={confirmCharityPayment.isPending}
                        className="btn-primary text-xs px-3 py-1.5 col-span-2 disabled:opacity-50"
                      >
                        Confirm Donation Made
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {contractRahn && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Collateral (Rahn)</h3>
            <p className="text-sm text-gray-900">{contractRahn.collateralDescription}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatNaira(contractRahn.collateralValue)} ·{" "}
              {contractRahn.collateralStatus === "CollateralActive" && <span className="text-emerald-600">Active</span>}
              {contractRahn.collateralStatus === "CollateralReleased" && <span className="text-gray-500">Released</span>}
              {contractRahn.collateralStatus === "CollateralEnforced" && <span className="text-red-600">Enforced</span>}
            </p>

            {contractValuationDocs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <h4 className="text-xs font-semibold text-gray-700">Submitted Valuation Documents</h4>
                {contractValuationDocs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-gray-700">{d.valuatorRef} · {formatDate(d.valuationDate)}</span>
                    <span className="font-mono text-gray-600">{formatNaira(d.valuationAmount)}</span>
                  </div>
                ))}
              </div>
            )}

            {contractRahn.collateralStatus === "CollateralActive" && <CollateralValuationUpload rahn={contractRahn} />}
          </div>
        )}

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
    </Layout>
  );
}
