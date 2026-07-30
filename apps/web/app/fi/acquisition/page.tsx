"use client";

import { useState } from "react";
import { Package, Truck, X, FileCheck, ShoppingCart, Landmark } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira } from "@/lib/formatters";
import {
  useMurabahahWads,
  useProceedDirectly,
  useAssetPurchaseRecords,
  useOfferMurabahah,
  useAssetRejectionRecords,
  useProceedWithReplacement,
  useAcquisitionCancellationRequests,
  useConfirmCancellation,
  useRejectCancellation,
  useMurabahahProposals,
  useWithdrawProposal,
  useAttachQuotation,
  useProceedWithWakala,
  useSupplierQuotations,
  useSupplierPaymentRecords,
  useRecordSupplierPayment,
  useDocumentEntries,
  useRegisterDocument,
  useSupersedeDocument,
  useRecordSupplierFailure,
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useConfirmPO,
  useMarkPartiallyFulfilled,
  useMarkFulfilled,
  useCancelPO,
  useCapitalCallRecords,
  useCreateCapitalCallRecord,
  type MurabahahWad,
  type AssetPurchaseRecord,
  type PaymentScheduleEntry,
  type AcquisitionCancellationRequestItem,
  type MurabahahProposal,
  type PurchaseOrder,
  type DocumentEntry,
} from "@/lib/apiClient";

// New page -- Stage 8's acquisition chain (MurabahahWad -> AssetPurchaseRecord
// -> MurabahahProposal) has no direct 1:1 legacy equivalent bundled the same
// way; frontend/src/pages/fi/AcquisitionQueue.tsx covers similar ground but
// against the real backend's fuller Wakala/quotation/delivery-milestone
// surface, all deferred here (see migrations/006_murabahah_stage8.sql's
// header). Same table+modal shape as the Stage 5-7 pages for consistency.

function ProceedDirectlyModal({ wad, onClose }: { wad: MurabahahWad; onClose: () => void }) {
  const [actualCost, setActualCost] = useState(wad.assetDetails.estimatedCost);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceRef, setInvoiceRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const proceed = useProceedDirectly();

  const handleConfirm = async () => {
    setError(null);
    if (!invoiceRef.trim()) {
      setError("Please provide an invoice reference");
      return;
    }
    if (actualCost <= 0) {
      setError("Actual cost must be positive");
      return;
    }
    try {
      await proceed.mutateAsync({ id: wad.id, actualCost, purchaseDate, invoiceRef });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record the purchase");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Record Asset Purchase</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {wad.businessName} <span className="font-mono">({wad.cacRegNumber})</span> -- {wad.assetDetails.description}
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Actual Cost (NGN)</label>
          <input type="number" className="input font-mono" value={actualCost} onChange={(e) => setActualCost(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Date</label>
          <input type="date" className="input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Invoice Reference <span className="text-red-500">*</span>
          </label>
          <input className="input" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="INV-2026-001" />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={proceed.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {proceed.isPending ? "Submitting…" : "Confirm Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OfferMurabahahModal({ record, onClose }: { record: AssetPurchaseRecord; onClose: () => void }) {
  const [profitAmount, setProfitAmount] = useState(Math.round(record.totalAcquisitionCost * 0.1));
  const [facilityRef, setFacilityRef] = useState(`FAC-${record.id}-${Date.now()}`);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const offer = useOfferMurabahah();

  const assetCost = record.totalAcquisitionCost;
  const salePrice = assetCost + profitAmount;
  const tenureMonths = record.terms.tenureMonths;
  const installmentAmount = Math.round((salePrice / tenureMonths) * 100) / 100;

  const handleConfirm = async () => {
    setError(null);
    if (!facilityRef.trim()) {
      setError("Please provide a facility reference");
      return;
    }
    if (profitAmount < 0) {
      setError("Profit amount must be non-negative");
      return;
    }
    const start = new Date(startDate);
    const schedule: PaymentScheduleEntry[] = Array.from({ length: tenureMonths }, (_, i) => {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i + 1);
      return { installmentNo: i + 1, dueDate: due.toISOString().slice(0, 10), dueAmount: installmentAmount };
    });
    try {
      await offer.mutateAsync({
        id: record.id,
        murabahahTerms: { assetCost, profitAmount, salePrice, installmentAmount, tenureMonths },
        paymentSchedule: schedule,
        facilityRef,
        startDate,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to offer the Murabahah proposal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Offer Murabahah Proposal</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {record.businessName} <span className="font-mono">({record.cacRegNumber})</span> -- {record.assetDescription}
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Facility Reference</label>
          <input className="input font-mono" value={facilityRef} onChange={(e) => setFacilityRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Asset Cost (fixed to acquisition cost)</label>
          <input className="input font-mono bg-gray-50" value={formatNaira(assetCost)} disabled readOnly />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Profit Amount (NGN)</label>
          <input type="number" className="input font-mono" value={profitAmount} onChange={(e) => setProfitAmount(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
          <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="rounded-xl bg-primary-50 p-3.5 mb-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Sale Price</span>
            <span className="font-mono font-semibold text-gray-900">{formatNaira(salePrice)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Tenure</span>
            <span className="font-mono text-gray-700">{tenureMonths} months</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Monthly Installment</span>
            <span className="font-mono text-gray-700">{formatNaira(installmentAmount)}</span>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={offer.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {offer.isPending ? "Submitting…" : "Send Offer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Phase 2, Thirty-Ninth Slice: ProceedWithReplacement (the FI's response to
// a business rejection) and WithdrawProposal (the FI pulls its own offer
// before the business responds). ConfirmCancellation/RejectCancellation are
// simple enough to render inline, no modal needed. ExpireProposal is
// deliberately not here -- its Daml controller is `vetify` alone (a system
// sweep once the acceptance window has elapsed, not an FI action), so it
// lives on /vetify/shariah-certification instead, the one vetify-facing
// page that already has full MurabahahProposal visibility.

function ProceedWithReplacementModal({ record, onClose }: { record: AssetPurchaseRecord; onClose: () => void }) {
  const [newActualCost, setNewActualCost] = useState<number | "">(record.totalAcquisitionCost);
  const [newPurchaseDate, setNewPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [newInvoiceRef, setNewInvoiceRef] = useState("");
  const [replacementNote, setReplacementNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const proceedWithReplacement = useProceedWithReplacement();

  const handleSubmit = async () => {
    setError(null);
    if (!newActualCost || !newInvoiceRef.trim() || !replacementNote.trim()) {
      setError("New cost, invoice reference, and a replacement note are all required");
      return;
    }
    try {
      await proceedWithReplacement.mutateAsync({ id: record.id, newActualCost: Number(newActualCost), newPurchaseDate, newInvoiceRef, replacementNote });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to replace the asset");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Replace Asset</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{record.assetDescription}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">New Actual Cost (NGN)</label>
          <input type="number" className="input text-sm font-mono" value={newActualCost} onChange={(e) => setNewActualCost(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">New Purchase Date</label>
          <input type="date" className="input text-sm" value={newPurchaseDate} onChange={(e) => setNewPurchaseDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">New Invoice Reference</label>
          <input className="input text-sm" value={newInvoiceRef} onChange={(e) => setNewInvoiceRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Replacement Note</label>
          <textarea rows={2} className="input text-sm resize-none" value={replacementNote} onChange={(e) => setReplacementNote(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={proceedWithReplacement.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {proceedWithReplacement.isPending ? "Submitting…" : "Replace Asset"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WithdrawProposalModal({ proposal, onClose }: { proposal: MurabahahProposal; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const withdraw = useWithdrawProposal();

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError("Please provide a reason");
      return;
    }
    try {
      await withdraw.mutateAsync({ id: proposal.id, reason });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to withdraw the proposal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Withdraw Proposal</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.facilityRef}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
          <textarea rows={2} className="input text-sm resize-none" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={withdraw.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {withdraw.isPending ? "Submitting…" : "Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Phase 2, Fortieth Slice: Wakala path (AttachQuotation/ProceedWithWakala),
// AssetPurchaseRecord supporting records (RecordSupplierPayment/
// RegisterDocument/RecordSupplierFailure), and the standalone PurchaseOrder/
// CapitalCallRecord procurement records. RecordAssetPurchase/DeclineAgency
// (MurabahahWakala, business-controlled) and RecordDeliveryMilestone
// (business-controlled) live on /business/acquisition instead.
// VerifyDocument is vetify-only -- lives on the new /vetify/documents page.

function AttachQuotationModal({ wad, onClose }: { wad: MurabahahWad; onClose: () => void }) {
  const [supplierName, setSupplierName] = useState("");
  const [quotationRef, setQuotationRef] = useState("");
  const [quotedAmount, setQuotedAmount] = useState(wad.assetDetails.estimatedCost);
  const [validUntil, setValidUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const attach = useAttachQuotation();

  const handleSubmit = async () => {
    setError(null);
    if (!supplierName.trim() || !quotationRef.trim()) {
      setError("Supplier name and quotation reference are required");
      return;
    }
    if (quotedAmount <= 0) {
      setError("Quoted amount must be positive");
      return;
    }
    try {
      await attach.mutateAsync({ id: wad.id, supplierName, quotationRef, quotedAmount, validUntil: validUntil || null });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to attach the quotation");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Attach Supplier Quotation</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{wad.assetDetails.description}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Supplier Name</label>
          <input className="input text-sm" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Quotation Reference</label>
          <input className="input text-sm font-mono" value={quotationRef} onChange={(e) => setQuotationRef(e.target.value)} placeholder="QUOTE-2026-001" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Quoted Amount (NGN)</label>
          <input type="number" className="input text-sm font-mono" value={quotedAmount} onChange={(e) => setQuotedAmount(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Valid Until (optional)</label>
          <input type="date" className="input text-sm" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={attach.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {attach.isPending ? "Attaching…" : "Attach Quotation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordSupplierPaymentModal({ record, onClose }: { record: AssetPurchaseRecord; onClose: () => void }) {
  const [amountPaid, setAmountPaid] = useState(record.totalAcquisitionCost);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentRef, setPaymentRef] = useState("");
  const [bankConfirmationRef, setBankConfirmationRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const record_ = useRecordSupplierPayment();

  const handleSubmit = async () => {
    setError(null);
    if (amountPaid <= 0 || !paymentRef.trim()) {
      setError("Payment amount and reference are required");
      return;
    }
    try {
      await record_.mutateAsync({ id: record.id, amountPaid, paymentDate, paymentRef, bankConfirmationRef: bankConfirmationRef || null });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record the supplier payment");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Record Supplier Payment</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{record.assetDescription}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Amount Paid (NGN)</label>
          <input type="number" className="input text-sm font-mono" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
          <input type="date" className="input text-sm" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Payment Reference</label>
          <input className="input text-sm font-mono" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="PAY-2026-001" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Bank Confirmation Ref (optional)</label>
          <input className="input text-sm font-mono" value={bankConfirmationRef} onChange={(e) => setBankConfirmationRef(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={record_.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {record_.isPending ? "Recording…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RegisterDocumentModal({ record, onClose }: { record: AssetPurchaseRecord; onClose: () => void }) {
  const [docType, setDocType] = useState("Invoice");
  const [contentHash, setContentHash] = useState("");
  const [storageRef, setStorageRef] = useState("");
  const [registeredBy, setRegisteredBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const register = useRegisterDocument();

  const handleSubmit = async () => {
    setError(null);
    if (!contentHash.trim() || !storageRef.trim() || !registeredBy.trim()) {
      setError("Content hash, storage reference, and registered-by name are all required");
      return;
    }
    try {
      await register.mutateAsync({ id: record.id, docType, contentHash, storageRef, registeredBy });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register the document");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Register Document</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{record.assetDescription}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
          <select className="input text-sm" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="Invoice">Invoice</option>
            <option value="BillOfLading">Bill of Lading</option>
            <option value="OwnershipTitle">Ownership Title</option>
            <option value="InsuranceCertificate">Insurance Certificate</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Content Hash (SHA-256)</label>
          <input className="input text-sm font-mono" value={contentHash} onChange={(e) => setContentHash(e.target.value)} placeholder="a1b2c3…" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Storage Reference</label>
          <input className="input text-sm font-mono" value={storageRef} onChange={(e) => setStorageRef(e.target.value)} placeholder="s3://vetify-docs/…" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Registered By</label>
          <input className="input text-sm" value={registeredBy} onChange={(e) => setRegisteredBy(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={register.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {register.isPending ? "Registering…" : "Register Document"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SupersedeDocumentModal({ entry, onClose }: { entry: DocumentEntry; onClose: () => void }) {
  const [docType, setDocType] = useState(entry.documentRef.docType);
  const [contentHash, setContentHash] = useState("");
  const [storageRef, setStorageRef] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supersede = useSupersedeDocument();

  const handleSubmit = async () => {
    setError(null);
    if (!contentHash.trim() || !storageRef.trim() || !reason.trim()) {
      setError("New content hash, storage reference, and a reason are all required");
      return;
    }
    try {
      await supersede.mutateAsync({ id: entry.id, docType, contentHash, storageRef, reason });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to supersede the document");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Supersede Document</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{entry.documentRef.storageRef}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
          <select className="input text-sm" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="Invoice">Invoice</option>
            <option value="BillOfLading">Bill of Lading</option>
            <option value="OwnershipTitle">Ownership Title</option>
            <option value="InsuranceCertificate">Insurance Certificate</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">New Content Hash (SHA-256)</label>
          <input className="input text-sm font-mono" value={contentHash} onChange={(e) => setContentHash(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">New Storage Reference</label>
          <input className="input text-sm font-mono" value={storageRef} onChange={(e) => setStorageRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
          <textarea rows={2} className="input text-sm resize-none" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={supersede.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {supersede.isPending ? "Superseding…" : "Supersede"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordSupplierFailureModal({ record, onClose }: { record: AssetPurchaseRecord; onClose: () => void }) {
  const [failureType, setFailureType] = useState<"SupplierCancelled" | "SupplierBankrupt" | "RefundIssued">("SupplierCancelled");
  const [failureDescription, setFailureDescription] = useState("");
  const [refundAmount, setRefundAmount] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const recordFailure = useRecordSupplierFailure();

  const handleSubmit = async () => {
    setError(null);
    if (!failureDescription.trim()) {
      setError("Please describe the failure");
      return;
    }
    try {
      await recordFailure.mutateAsync({ id: record.id, failureType, failureDescription, refundAmount: refundAmount === "" ? null : Number(refundAmount) });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record the supplier failure");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Report Supplier Failure</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-amber-600 mb-4">This archives the purchase record — the acquisition must restart from a fresh Wa&apos;d or Wakala.</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Failure Type</label>
          <select className="input text-sm" value={failureType} onChange={(e) => setFailureType(e.target.value as typeof failureType)}>
            <option value="SupplierCancelled">Supplier Cancelled</option>
            <option value="SupplierBankrupt">Supplier Bankrupt</option>
            <option value="RefundIssued">Refund Issued</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea rows={2} className="input text-sm resize-none" value={failureDescription} onChange={(e) => setFailureDescription(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Refund Amount (optional)</label>
          <input type="number" className="input text-sm font-mono" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={recordFailure.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {recordFailure.isPending ? "Recording…" : "Report Failure"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatePurchaseOrderModal({ onClose }: { onClose: () => void }) {
  const [cacRegNumber, setCacRegNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [facilityRef, setFacilityRef] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [totalOrderValue, setTotalOrderValue] = useState(0);
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  const [poRef, setPoRef] = useState(`PO-${Date.now()}`);
  const [error, setError] = useState<string | null>(null);
  const create = useCreatePurchaseOrder();

  const handleSubmit = async () => {
    setError(null);
    if (!cacRegNumber.trim() || !businessName.trim() || !facilityRef.trim() || !supplierName.trim() || !itemDescription.trim() || !deliveryDeadline) {
      setError("All fields are required");
      return;
    }
    if (totalOrderValue <= 0) {
      setError("Total order value must be positive");
      return;
    }
    try {
      await create.mutateAsync({
        cacRegNumber, businessName, facilityRef, supplierName,
        supplierDetails: { name: supplierName },
        orderedItems: [{ description: itemDescription, value: totalOrderValue }],
        totalOrderValue, deliveryDeadline, poRef,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the purchase order");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Purchase Order</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">CAC Registration Number</label>
          <input className="input text-sm font-mono" value={cacRegNumber} onChange={(e) => setCacRegNumber(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Business Name</label>
          <input className="input text-sm" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Facility Reference</label>
          <input className="input text-sm font-mono" value={facilityRef} onChange={(e) => setFacilityRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Supplier Name</label>
          <input className="input text-sm" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Item Description</label>
          <input className="input text-sm" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Total Order Value (NGN)</label>
          <input type="number" className="input text-sm font-mono" value={totalOrderValue} onChange={(e) => setTotalOrderValue(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Deadline</label>
          <input type="date" className="input text-sm" value={deliveryDeadline} onChange={(e) => setDeliveryDeadline(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">PO Reference</label>
          <input className="input text-sm font-mono" value={poRef} onChange={(e) => setPoRef(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create PO"}
          </button>
        </div>
      </div>
    </div>
  );
}

type POAction = "confirm" | "partial" | "fulfilled" | "cancel";
const PO_ACTION_LABEL: Record<POAction, string> = {
  confirm: "Confirm Purchase Order",
  partial: "Mark Partially Fulfilled",
  fulfilled: "Mark Fulfilled",
  cancel: "Cancel Purchase Order",
};
const PO_ACTION_FIELD_LABEL: Record<POAction, string> = {
  confirm: "Confirmation Reference",
  partial: "Delivery Reference",
  fulfilled: "Delivery Reference",
  cancel: "Reason",
};

function POActionModal({ po, action, onClose }: { po: PurchaseOrder; action: POAction; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirmPO = useConfirmPO();
  const markPartial = useMarkPartiallyFulfilled();
  const markFull = useMarkFulfilled();
  const cancel = useCancelPO();
  const isPending = confirmPO.isPending || markPartial.isPending || markFull.isPending || cancel.isPending;

  const handleSubmit = async () => {
    setError(null);
    if (!value.trim()) {
      setError(`${PO_ACTION_FIELD_LABEL[action]} is required`);
      return;
    }
    try {
      if (action === "confirm") await confirmPO.mutateAsync({ id: po.id, confirmationRef: value });
      else if (action === "partial") await markPartial.mutateAsync({ id: po.id, deliveryRef: value });
      else if (action === "fulfilled") await markFull.mutateAsync({ id: po.id, deliveryRef: value });
      else await cancel.mutateAsync({ id: po.id, reason: value });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update the purchase order");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{PO_ACTION_LABEL[action]}</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{po.poRef}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">{PO_ACTION_FIELD_LABEL[action]}</label>
          <input className="input text-sm" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending} className={`flex-1 disabled:opacity-40 ${action === "cancel" ? "btn-danger" : "btn-primary"}`}>
            {isPending ? "Submitting…" : PO_ACTION_LABEL[action]}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateCapitalCallModal({ onClose }: { onClose: () => void }) {
  const [cacRegNumber, setCacRegNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [facilityRef, setFacilityRef] = useState("");
  const [trancheNumber, setTrancheNumber] = useState(1);
  const [trancheAmount, setTrancheAmount] = useState(0);
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().slice(0, 10));
  const [purposeOfTranche, setPurposeOfTranche] = useState("");
  const [disbursementRef, setDisbursementRef] = useState("");
  const [cumulativeDisbursed, setCumulativeDisbursed] = useState(0);
  const [remainingFacility, setRemainingFacility] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateCapitalCallRecord();

  const handleSubmit = async () => {
    setError(null);
    if (!cacRegNumber.trim() || !businessName.trim() || !facilityRef.trim() || !purposeOfTranche.trim() || !disbursementRef.trim()) {
      setError("All text fields are required");
      return;
    }
    if (trancheAmount <= 0) {
      setError("Tranche amount must be positive");
      return;
    }
    if (cumulativeDisbursed < trancheAmount) {
      setError("Cumulative disbursed must be at least the tranche amount");
      return;
    }
    try {
      await create.mutateAsync({
        cacRegNumber, businessName, facilityRef, trancheNumber, trancheAmount, disbursementDate,
        purposeOfTranche, disbursementRef, cumulativeDisbursed, remainingFacility,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the capital call record");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Capital Call Record</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">CAC Registration Number</label>
          <input className="input text-sm font-mono" value={cacRegNumber} onChange={(e) => setCacRegNumber(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Business Name</label>
          <input className="input text-sm" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Facility Reference</label>
          <input className="input text-sm font-mono" value={facilityRef} onChange={(e) => setFacilityRef(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tranche Number</label>
            <input type="number" className="input text-sm font-mono" value={trancheNumber} onChange={(e) => setTrancheNumber(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tranche Amount (NGN)</label>
            <input type="number" className="input text-sm font-mono" value={trancheAmount} onChange={(e) => setTrancheAmount(Number(e.target.value))} />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Disbursement Date</label>
          <input type="date" className="input text-sm" value={disbursementDate} onChange={(e) => setDisbursementDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Purpose of Tranche</label>
          <input className="input text-sm" value={purposeOfTranche} onChange={(e) => setPurposeOfTranche(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Disbursement Reference</label>
          <input className="input text-sm font-mono" value={disbursementRef} onChange={(e) => setDisbursementRef(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cumulative Disbursed (NGN)</label>
            <input type="number" className="input text-sm font-mono" value={cumulativeDisbursed} onChange={(e) => setCumulativeDisbursed(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Remaining Facility (NGN)</label>
            <input type="number" className="input text-sm font-mono" value={remainingFacility} onChange={(e) => setRemainingFacility(Number(e.target.value))} />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create Record"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingCancellationRow({ cancellation, record }: { cancellation: AcquisitionCancellationRequestItem; record: AssetPurchaseRecord | undefined }) {
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirmCancellation();
  const reject = useRejectCancellation();

  const handleConfirm = async () => {
    setError(null);
    if (!record) return;
    try {
      await confirm.mutateAsync({ id: record.id, requestId: cancellation.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm cancellation");
    }
  };

  const handleReject = async () => {
    setError(null);
    try {
      await reject.mutateAsync({ id: cancellation.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject cancellation");
    }
  };

  return (
    <div className="card p-4">
      <p className="text-sm text-gray-900">{cancellation.businessName}</p>
      <p className="text-xs text-gray-500 mt-0.5">{cancellation.reason}</p>
      <div className="flex gap-2 mt-2">
        <button onClick={handleReject} disabled={reject.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">
          {reject.isPending ? "Rejecting…" : "Reject"}
        </button>
        <button onClick={handleConfirm} disabled={confirm.isPending || !record} className="btn-danger text-xs px-3 py-1.5 disabled:opacity-40">
          {confirm.isPending ? "Confirming…" : "Confirm Cancellation"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

const PO_ACTIONS: Record<PurchaseOrder["status"], POAction[]> = {
  POIssued: ["confirm", "cancel"],
  POConfirmed: ["partial", "fulfilled", "cancel"],
  POPartiallyFulfilled: ["fulfilled"],
  POFulfilled: [],
  POCancelled: [],
};

export default function FiAcquisitionPage() {
  const { data: wads, isLoading: loadingWads, isError: errorWads } = useMurabahahWads();
  const { data: records, isLoading: loadingRecords, isError: errorRecords } = useAssetPurchaseRecords();
  const { data: rejectionRecords } = useAssetRejectionRecords();
  const { data: cancellationRequests } = useAcquisitionCancellationRequests();
  const { data: proposals } = useMurabahahProposals();
  const { data: quotations } = useSupplierQuotations();
  const { data: paymentRecords } = useSupplierPaymentRecords();
  const { data: documentEntries } = useDocumentEntries();
  const { data: purchaseOrders } = usePurchaseOrders();
  const { data: capitalCallRecords } = useCapitalCallRecords();
  const [purchaseModal, setPurchaseModal] = useState<MurabahahWad | null>(null);
  const [offerModal, setOfferModal] = useState<AssetPurchaseRecord | null>(null);
  const [replacementModal, setReplacementModal] = useState<AssetPurchaseRecord | null>(null);
  const [withdrawModal, setWithdrawModal] = useState<MurabahahProposal | null>(null);
  const [quotationModal, setQuotationModal] = useState<MurabahahWad | null>(null);
  const [paymentModal, setPaymentModal] = useState<AssetPurchaseRecord | null>(null);
  const [documentModal, setDocumentModal] = useState<AssetPurchaseRecord | null>(null);
  const [supersedeModal, setSupersedeModal] = useState<DocumentEntry | null>(null);
  const [failureModal, setFailureModal] = useState<AssetPurchaseRecord | null>(null);
  const [poModal, setPoModal] = useState(false);
  const [poActionModal, setPoActionModal] = useState<{ po: PurchaseOrder; action: POAction } | null>(null);
  const [capitalCallModal, setCapitalCallModal] = useState(false);
  const proceedWithWakala = useProceedWithWakala();

  if (loadingWads || loadingRecords) return <Layout title="Asset Acquisition"><FullPageLoader /></Layout>;
  if (errorWads || errorRecords || !wads || !records) {
    return <Layout title="Asset Acquisition"><ErrorState message="Failed to load acquisition queue" /></Layout>;
  }

  const rejectedRecordIds = new Set((rejectionRecords ?? []).map((r) => r.assetPurchaseRecordId));
  const readyToOffer = records.filter((r) => r.deliveryAcknowledged);
  const rejectedRecords = records.filter((r) => !r.deliveryAcknowledged && rejectedRecordIds.has(r.id));
  const pendingCancellations = (cancellationRequests ?? []).filter((c) => c.status === "Pending");
  const recordById = new Map(records.map((r) => [r.id, r]));
  const quotationsByWad = new Map<string, typeof quotations>();
  for (const q of quotations ?? []) {
    quotationsByWad.set(q.murabahahWadId, [...(quotationsByWad.get(q.murabahahWadId) ?? []), q]);
  }
  const paymentCountByRecord = new Map<string, number>();
  for (const p of paymentRecords ?? []) paymentCountByRecord.set(p.assetPurchaseRecordId, (paymentCountByRecord.get(p.assetPurchaseRecordId) ?? 0) + 1);
  const documentsByRecord = new Map<string, DocumentEntry[]>();
  for (const d of documentEntries ?? []) documentsByRecord.set(d.assetPurchaseRecordId, [...(documentsByRecord.get(d.assetPurchaseRecordId) ?? []), d]);

  return (
    <Layout title="Asset Acquisition">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Awaiting Asset Purchase</h2>
          </div>
          <div className="card overflow-hidden">
            {wads.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No pending asset purchases</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {wads.map((wad) => (
                  <div key={wad.id} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{wad.businessName}</p>
                        <p className="text-xs text-gray-500 font-mono">{wad.cacRegNumber}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{wad.assetDetails.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-mono text-gray-700">{formatNaira(wad.assetDetails.estimatedCost)}</span>
                        <button onClick={() => setQuotationModal(wad)} className="btn-secondary text-xs px-3 py-1.5">
                          Attach Quotation
                        </button>
                        <button
                          onClick={() => proceedWithWakala.mutate(wad.id)}
                          disabled={proceedWithWakala.isPending}
                          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                        >
                          Use Wakala Agency
                        </button>
                        <button onClick={() => setPurchaseModal(wad)} className="btn-primary text-xs px-3 py-1.5">
                          Record Purchase
                        </button>
                      </div>
                    </div>
                    {(quotationsByWad.get(wad.id) ?? []).length > 0 && (
                      <div className="mt-2 pl-0.5 space-y-1">
                        {(quotationsByWad.get(wad.id) ?? []).map((q) => (
                          <p key={q.id} className="text-xs text-gray-500">
                            Quote: <span className="font-mono">{q.quotationRef}</span> · {q.supplierName} · {formatNaira(q.quotedAmount)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Ready to Offer (Qabdh confirmed)</h2>
          </div>
          <div className="card overflow-hidden">
            {readyToOffer.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No asset purchases awaiting an offer</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {readyToOffer.map((record) => (
                  <div key={record.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{record.businessName}</p>
                      <p className="text-xs text-gray-500 font-mono">{record.cacRegNumber}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{record.assetDescription}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-mono text-gray-700">{formatNaira(record.totalAcquisitionCost)}</span>
                      <button onClick={() => setOfferModal(record)} className="btn-primary text-xs px-3 py-1.5">
                        Offer Murabahah
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {rejectedRecords.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Rejected Deliveries</h2>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {rejectedRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{record.businessName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{record.assetDescription}</p>
                  </div>
                  <button onClick={() => setReplacementModal(record)} className="btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                    Replace Asset
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingCancellations.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Pending Cancellation Requests</h2>
            <div className="space-y-3">
              {pendingCancellations.map((c) => (
                <PendingCancellationRow key={c.id} cancellation={c} record={recordById.get(c.assetPurchaseRecordId)} />
              ))}
            </div>
          </div>
        )}

        {(proposals ?? []).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Sent Proposals</h2>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {(proposals ?? []).map((proposal) => (
                <div key={proposal.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 font-mono">{proposal.facilityRef}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatNaira(proposal.murabahahTerms.salePrice)} · {proposal.murabahahTerms.tenureMonths} months</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setWithdrawModal(proposal)} className="btn-danger text-xs px-3 py-1.5">
                      Withdraw
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {records.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileCheck size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Supplier & Document Management</h2>
            </div>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {records.map((record) => (
                <div key={record.id} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{record.businessName}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{record.assetDescription}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {paymentCountByRecord.get(record.id) ?? 0} supplier payment(s) · {(documentsByRecord.get(record.id) ?? []).length} document(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setPaymentModal(record)} className="btn-secondary text-xs px-3 py-1.5">
                        Record Payment
                      </button>
                      <button onClick={() => setDocumentModal(record)} className="btn-secondary text-xs px-3 py-1.5">
                        Register Document
                      </button>
                      <button onClick={() => setFailureModal(record)} className="btn-danger text-xs px-3 py-1.5">
                        Report Failure
                      </button>
                    </div>
                  </div>
                  {(documentsByRecord.get(record.id) ?? []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {(documentsByRecord.get(record.id) ?? []).map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-2">
                          <p className="text-xs text-gray-500">
                            {d.documentRef.docType} · <span className="font-mono">{d.documentRef.storageRef}</span>{" "}
                            {d.superseded ? "(superseded)" : d.verifiedAt ? "(verified)" : "(pending verification)"}
                          </p>
                          {!d.superseded && (
                            <button onClick={() => setSupersedeModal(d)} className="text-xs text-gray-400 hover:text-gray-700 flex-shrink-0">
                              Supersede
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Purchase Orders</h2>
            </div>
            <button onClick={() => setPoModal(true)} className="btn-secondary text-xs px-3 py-1.5">
              New Purchase Order
            </button>
          </div>
          <div className="card overflow-hidden">
            {(purchaseOrders ?? []).length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No purchase orders yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(purchaseOrders ?? []).map((po) => (
                  <div key={po.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{po.businessName}</p>
                      <p className="text-xs text-gray-500 font-mono">{po.poRef} · {po.supplierName}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{formatNaira(po.totalOrderValue)} · <span className="font-mono">{po.status}</span></p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {PO_ACTIONS[po.status].map((action) => (
                        <button
                          key={action}
                          onClick={() => setPoActionModal({ po, action })}
                          className={`text-xs px-3 py-1.5 ${action === "cancel" ? "btn-danger" : "btn-secondary"}`}
                        >
                          {PO_ACTION_LABEL[action]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Landmark size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Capital Call Records</h2>
            </div>
            <button onClick={() => setCapitalCallModal(true)} className="btn-secondary text-xs px-3 py-1.5">
              New Capital Call
            </button>
          </div>
          <div className="card overflow-hidden">
            {(capitalCallRecords ?? []).length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No capital call records yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(capitalCallRecords ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.businessName}</p>
                      <p className="text-xs text-gray-500 font-mono">{c.disbursementRef} · Tranche {c.trancheNumber}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{c.purposeOfTranche}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono text-gray-900">{formatNaira(c.trancheAmount)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Remaining: {formatNaira(c.remainingFacility)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {purchaseModal && <ProceedDirectlyModal wad={purchaseModal} onClose={() => setPurchaseModal(null)} />}
      {replacementModal && <ProceedWithReplacementModal record={replacementModal} onClose={() => setReplacementModal(null)} />}
      {withdrawModal && <WithdrawProposalModal proposal={withdrawModal} onClose={() => setWithdrawModal(null)} />}
      {offerModal && <OfferMurabahahModal record={offerModal} onClose={() => setOfferModal(null)} />}
      {quotationModal && <AttachQuotationModal wad={quotationModal} onClose={() => setQuotationModal(null)} />}
      {paymentModal && <RecordSupplierPaymentModal record={paymentModal} onClose={() => setPaymentModal(null)} />}
      {documentModal && <RegisterDocumentModal record={documentModal} onClose={() => setDocumentModal(null)} />}
      {supersedeModal && <SupersedeDocumentModal entry={supersedeModal} onClose={() => setSupersedeModal(null)} />}
      {failureModal && <RecordSupplierFailureModal record={failureModal} onClose={() => setFailureModal(null)} />}
      {poModal && <CreatePurchaseOrderModal onClose={() => setPoModal(false)} />}
      {poActionModal && <POActionModal po={poActionModal.po} action={poActionModal.action} onClose={() => setPoActionModal(null)} />}
      {capitalCallModal && <CreateCapitalCallModal onClose={() => setCapitalCallModal(false)} />}
    </Layout>
  );
}
