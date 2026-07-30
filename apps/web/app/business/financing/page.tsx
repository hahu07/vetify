"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TrendingUp, CheckCircle2, Calculator, ShieldCheck, Clock3, FileEdit, X } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira, formatDate, calculateInstallment } from "@/lib/formatters";
import {
  useApprovedBusinesses, useCreateFinancing, useFinancingList,
  useWithdrawRequest, useFinancingAmendments, useAcceptAmendment, useDeclineAmendment,
  type FinancingAmendment,
} from "@/lib/apiClient";

// Simplified port of frontend/src/pages/business/FinancingForm.tsx. The real
// page also picks among multiple ApprovedProvider institutions and enforces
// FI-configured UnderwritingPolicy min/max bounds -- both are out of scope
// for this migration (lib/domain/financing.ts's header: "AssignAssessor,
// Withdraw/Expire/Cancel/ProposeAmendment, UnderwritingPolicy... are
// deliberately deferred"), so this form has no FI picker and no
// policy-driven bounds; the profit-margin estimate is a fixed platform
// default, same as the real page's fallback when an FI hasn't set one.
const DEFAULT_INDICATIVE_PROFIT_MARGIN_PCT = 15;
const TENURE_OPTIONS = [6, 12, 18, 24];
const ACTIVE_FINANCING_STATUSES = new Set(["Submitted", "Underwriting", "UnderwritingManualReview"]);
// Mirrors lib/domain/financing.ts's OPEN_FINANCING_STATUSES -- WithdrawRequest
// is only valid from Submitted or Underwriting, not UnderwritingManualReview.
const WITHDRAWABLE_STATUSES = new Set(["Submitted", "Underwriting"]);

const schema = z.object({
  amount: z.number().positive("Please enter a valid amount"),
  purpose: z.string().min(20, "Please describe the purpose in at least 20 characters").max(500, "Maximum 500 characters"),
  tenureMonths: z.number(),
});
type FormData = z.infer<typeof schema>;

// Phase 2, Forty-First Slice: WithdrawRequest (business, only valid from
// Submitted or Underwriting -- OPEN_FINANCING_STATUSES) and the business's
// side of the amendment flow (AcceptAmendment/DeclineAmendment, responding
// to a financialInstitution-proposed FinancingAmendment).

function WithdrawModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const withdraw = useWithdrawRequest();

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError("Please provide a reason");
      return;
    }
    try {
      await withdraw.mutateAsync({ id: requestId, reason });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to withdraw the request");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Withdraw Financing Request</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
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

function DeclineAmendmentModal({ amendment, onClose }: { amendment: FinancingAmendment; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const decline = useDeclineAmendment();

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError("Please provide a reason");
      return;
    }
    try {
      await decline.mutateAsync({ id: amendment.id, reason });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decline the amendment");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Decline Amendment</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{amendment.financingRef}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
          <textarea rows={2} className="input text-sm resize-none" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={decline.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {decline.isPending ? "Submitting…" : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AmendmentRow({ amendment, onDecline }: { amendment: FinancingAmendment; onDecline: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const accept = useAcceptAmendment();

  const handleAccept = async () => {
    setError(null);
    try {
      await accept.mutateAsync(amendment.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept the amendment");
    }
  };

  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-gray-900 font-mono">{amendment.financingRef}</p>
      <p className="text-xs text-gray-500 mt-1">
        {formatNaira(amendment.originalTerms.amount)} → <span className="font-semibold text-gray-800">{formatNaira(amendment.proposedTerms.amount)}</span>
        {" "}· {amendment.originalTerms.tenureMonths} → {amendment.proposedTerms.tenureMonths} months
      </p>
      {amendment.proposalNote && <p className="text-xs text-gray-500 mt-1">{amendment.proposalNote}</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button onClick={onDecline} className="btn-secondary text-xs px-3 py-1.5">Decline</button>
        <button onClick={handleAccept} disabled={accept.isPending} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40">
          {accept.isPending ? "Accepting…" : "Accept Amendment"}
        </button>
      </div>
    </div>
  );
}

export default function FinancingFormPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: approvedBusinesses, isLoading, isError } = useApprovedBusinesses();
  const { data: financingRequests } = useFinancingList();
  const { data: amendments } = useFinancingAmendments();
  const createFinancing = useCreateFinancing();
  const approvedBusiness = approvedBusinesses?.find((b) => b.status === "BusinessActive");
  const [withdrawModal, setWithdrawModal] = useState<string | null>(null);
  const [declineAmendmentModal, setDeclineAmendmentModal] = useState<FinancingAmendment | null>(null);
  const pendingAmendments = (amendments ?? []).filter((a) => a.status === "Pending");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 1_500_000, purpose: "", tenureMonths: 18 },
  });

  const watchedAmount = watch("amount") || 0;
  const watchedTenure = watch("tenureMonths") || TENURE_OPTIONS[0];
  const totalProfit = watchedAmount * (DEFAULT_INDICATIVE_PROFIT_MARGIN_PCT / 100);
  const salePrice = watchedAmount + totalProfit;
  const monthlyInstallment = calculateInstallment(watchedAmount, DEFAULT_INDICATIVE_PROFIT_MARGIN_PCT, watchedTenure);

  const sortedRequests = [...(financingRequests ?? [])].sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  const activeRequestCount = sortedRequests.filter((r) => ACTIVE_FINANCING_STATUSES.has(r.status)).length;

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    if (!approvedBusiness) {
      setSubmitError("No approved business record found -- complete onboarding and compliance review first.");
      return;
    }
    try {
      await createFinancing.mutateAsync({
        terms: { amount: data.amount, purpose: data.purpose, tenureMonths: data.tenureMonths },
        financingRef: `FIN-${Date.now()}`,
        businessSector: "Retail Trade",
      });
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit financing request");
    }
  };

  if (isLoading) return <Layout title="Financing Request"><FullPageLoader /></Layout>;
  if (isError) return <Layout title="Financing Request"><ErrorState message="Failed to load account status" /></Layout>;

  return (
    <Layout title="Financing Request">
      <div className="max-w-5xl mx-auto">
        {approvedBusiness ? (
          <div className="rounded-2xl p-5 mb-7 bg-emerald-50 border border-emerald-100 flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Approved Business</p>
              <p className="text-sm text-emerald-700 mt-0.5">You&apos;re eligible to request Murabahah financing.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-5 mb-7 bg-amber-50 border border-amber-100">
            <p className="text-sm font-semibold text-amber-800">No approved business record found</p>
            <p className="text-sm text-amber-700 mt-0.5">Complete onboarding and compliance review before requesting financing.</p>
          </div>
        )}

        {sortedRequests.length > 0 && (
          <div className="card p-6 mb-7">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock3 size={16} className="text-gray-400" />
                <h3 className="font-display text-base font-semibold text-gray-800 tracking-tight">Your Financing Requests</h3>
              </div>
              {activeRequestCount > 0 && <span className="text-xs font-medium text-gray-500">{activeRequestCount} in progress</span>}
            </div>
            <div className="space-y-2.5">
              {sortedRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-surface border border-gray-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 font-mono">{req.financingRef}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatNaira(req.terms.amount)} · {req.terms.tenureMonths} months
                      {req.submittedAt && <> · Submitted {formatDate(req.submittedAt)}</>}
                    </p>
                  </div>
                  {WITHDRAWABLE_STATUSES.has(req.status) && (
                    <button onClick={() => setWithdrawModal(req.id)} className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0">
                      Withdraw
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingAmendments.length > 0 && (
          <div className="card p-6 mb-7">
            <div className="flex items-center gap-2 mb-4">
              <FileEdit size={16} className="text-gray-400" />
              <h3 className="font-display text-base font-semibold text-gray-800 tracking-tight">Pending Amendments</h3>
            </div>
            <div className="space-y-2.5">
              {pendingAmendments.map((a) => (
                <AmendmentRow key={a.id} amendment={a} onDecline={() => setDeclineAmendmentModal(a)} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 card p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-gray-900 tracking-tight">Financing Request</h2>
                <p className="text-sm text-gray-500 mt-0.5">Murabahah-compliant business financing</p>
              </div>
            </div>

            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 size={32} className="text-emerald-600" />
                </div>
                <h3 className="font-display text-xl font-semibold text-gray-900 mb-3">Financing Request Submitted!</h3>
                <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                  An assessor will review your request. Check &quot;Your Financing Requests&quot; above for status updates.
                </p>
                <button onClick={() => setSubmitted(false)} className="btn-primary text-sm px-5 py-2.5">
                  Submit Another Request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Financing Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-display text-xl font-semibold text-gray-300 pointer-events-none">₦</span>
                    <input
                      id="amount"
                      type="number"
                      step={10000}
                      className={`w-full pl-11 pr-5 py-3.5 font-display text-xl font-semibold text-gray-900 bg-surface border-2 rounded-xl placeholder-gray-300 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-colors ${errors.amount ? "border-red-300" : "border-gray-200"}`}
                      {...register("amount", { valueAsNumber: true })}
                    />
                  </div>
                  {errors.amount && <p className="mt-1.5 text-xs text-red-600">{errors.amount.message}</p>}
                </div>

                <div>
                  <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-2">
                    Business Purpose <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="purpose"
                    rows={4}
                    className={`input resize-none text-sm py-3 ${errors.purpose ? "input-error" : ""}`}
                    placeholder="Describe how this financing will be used -- e.g., purchase of equipment, inventory acquisition, working capital expansion..."
                    {...register("purpose")}
                  />
                  {errors.purpose && <p className="mt-1.5 text-xs text-red-600">{errors.purpose.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Repayment Tenure <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {TENURE_OPTIONS.map((months) => (
                      <label key={months} className="cursor-pointer">
                        <input
                          type="radio"
                          value={months}
                          className="sr-only"
                          {...register("tenureMonths", { onChange: () => setValue("tenureMonths", months, { shouldValidate: true }) })}
                        />
                        <div
                          className={`text-center py-3.5 px-1.5 rounded-xl border-2 transition-all cursor-pointer ${
                            watchedTenure === months ? "border-primary bg-primary text-white" : "border-gray-200 text-gray-700 hover:border-primary/40"
                          }`}
                        >
                          <span className="block text-base font-semibold">{months}</span>
                          <span className={`block text-[11px] mt-0.5 ${watchedTenure === months ? "text-white/75" : "text-gray-400"}`}>months</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.tenureMonths && <p className="mt-1.5 text-xs text-red-600">{errors.tenureMonths.message}</p>}
                </div>

                {submitError && <p className="text-xs text-red-600">{submitError}</p>}

                <button type="submit" disabled={createFinancing.isPending} className="btn-primary w-full py-3.5 text-sm disabled:opacity-50">
                  {createFinancing.isPending ? "Submitting…" : "Submit Financing Request"}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6 space-y-5">
              <div className="rounded-2xl p-6 bg-primary-dark">
                <div className="flex items-center gap-2 mb-6">
                  <Calculator size={16} className="text-accent-400" />
                  <h3 className="text-sm font-semibold text-white/90">Estimated Terms</h3>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center py-3 border-b border-white/10">
                    <span className="text-xs text-white/60">Asset Cost (Principal)</span>
                    <span className="font-mono text-sm text-white/90">{formatNaira(watchedAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/10">
                    <span className="text-xs text-white/60">Profit Margin ({DEFAULT_INDICATIVE_PROFIT_MARGIN_PCT}%)</span>
                    <span className="font-mono text-sm text-white/90">{formatNaira(totalProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center py-4">
                    <span className="text-xs font-medium text-white/70">Sale Price (Total)</span>
                    <span className="font-display font-semibold text-2xl text-white">{formatNaira(salePrice)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div>
                    <p className="text-xs text-white/60 mb-1">Tenure</p>
                    <p className="text-sm font-medium text-white">{watchedTenure} months</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/60 mb-1">Monthly Installment</p>
                    <p className="font-display font-bold text-xl text-accent-400">
                      {formatNaira(monthlyInstallment)}
                      <span className="text-xs font-sans font-normal text-white/50">/mo</span>
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-white/40 mt-5 leading-relaxed">
                  * Estimates only. Actual terms are finalized by the financial institution after underwriting review.
                </p>
              </div>

              <div className="card p-5 bg-primary-50 border-primary/10">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={16} className="text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">Shariah Compliant</p>
                    <p className="text-xs text-primary/80 leading-relaxed">
                      Certified under AAOIFI Standard No. 8 (Murabahah). All profit is disclosed upfront -- no hidden charges.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {withdrawModal && <WithdrawModal requestId={withdrawModal} onClose={() => setWithdrawModal(null)} />}
      {declineAmendmentModal && <DeclineAmendmentModal amendment={declineAmendmentModal} onClose={() => setDeclineAmendmentModal(null)} />}
    </Layout>
  );
}
