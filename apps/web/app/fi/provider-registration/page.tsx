"use client";

import { useState } from "react";
import { Building2, Send, Edit3 } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import {
  useProviderOnboardings,
  useCreateProviderOnboarding,
  useSubmitProviderForReview,
  useAmendProvider,
  type ProviderType,
  type FinancingInstrument,
} from "@/lib/apiClient";

// New page -- Stage 0 (daml/Vetify/FinancingProvider.daml), the FI's own
// side of the FinancingProviderOnboarding lifecycle. No legacy-frontend
// equivalent exists (backend/src/routes/providers.ts had no prior UI
// anywhere in this migration). Every FI must complete this registration
// before it can offer financing -- see migrations/016's header for the
// current scope limits (not yet wired into ApproveFunding).

const PROVIDER_TYPES: ProviderType[] = [
  "CBNLicensedNIFI", "SECFundManager", "PenComPensionManager", "CooperativeSociety",
  "InvestmentClub", "WaqfFund", "ZakatFund", "Philanthropy",
];
const REGULATED_TYPES: ProviderType[] = ["CBNLicensedNIFI", "SECFundManager", "PenComPensionManager"];
const INSTRUMENTS: FinancingInstrument[] = ["Murabahah", "Ijarah", "QardHasan"];

function RegistrationForm({
  mode,
  initial,
  onSubmit,
  isPending,
}: {
  mode: "create" | "amend";
  initial?: {
    providerName: string; address: string; cacRegNumber: string; providerType: ProviderType;
    licenseNumber?: string; declaredInstruments: FinancingInstrument[];
  };
  onSubmit: (args: {
    providerName: string; address: string; cacRegNumber: string; providerType: ProviderType;
    regulatoryBody: string | null; licenseNumber: string | null; declaredInstruments: FinancingInstrument[];
  }) => Promise<void>;
  isPending: boolean;
}) {
  const [providerName, setProviderName] = useState(initial?.providerName ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [cacRegNumber, setCacRegNumber] = useState(initial?.cacRegNumber ?? "");
  const [providerType, setProviderType] = useState<ProviderType>(initial?.providerType ?? "CooperativeSociety");
  const [licenseNumber, setLicenseNumber] = useState(initial?.licenseNumber ?? "");
  const [instruments, setInstruments] = useState<FinancingInstrument[]>(initial?.declaredInstruments ?? []);
  const [error, setError] = useState<string | null>(null);

  const toggleInstrument = (i: FinancingInstrument) => {
    setInstruments((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!providerName.trim() || !address.trim() || !cacRegNumber.trim()) {
      setError("Provider name, address, and CAC registration number are all required");
      return;
    }
    if (instruments.length === 0) {
      setError("Must declare at least one financing instrument");
      return;
    }
    const isRegulated = REGULATED_TYPES.includes(providerType);
    try {
      await onSubmit({
        providerName,
        address,
        cacRegNumber,
        providerType,
        regulatoryBody: isRegulated ? providerType.replace(/^CBN.*/, "CBN").replace(/^SEC.*/, "SEC").replace(/^PenCom.*/, "PenCom") : null,
        licenseNumber: licenseNumber.trim() || null,
        declaredInstruments: instruments,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    }
  };

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">{mode === "create" ? "Register as a Financing Provider" : "Amend Registration"}</h2>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input className="input text-sm" placeholder="Provider / institution name" value={providerName} onChange={(e) => setProviderName(e.target.value)} />
        <input className="input text-sm" placeholder="CAC registration number" value={cacRegNumber} onChange={(e) => setCacRegNumber(e.target.value)} />
      </div>
      <input className="input text-sm mb-3" placeholder="Registered address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Provider Type</label>
          <select className="input text-sm" value={providerType} onChange={(e) => setProviderType(e.target.value as ProviderType)}>
            {PROVIDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <input
          className="input text-sm"
          placeholder={REGULATED_TYPES.includes(providerType) ? "License number (required for this type)" : "License number (optional)"}
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
        />
      </div>
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Financing Instruments Offered (at least one)</label>
        <div className="flex flex-wrap gap-2">
          {INSTRUMENTS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleInstrument(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                instruments.includes(i) ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      <button onClick={handleSubmit} disabled={isPending} className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        {mode === "create" ? <Building2 size={14} /> : <Edit3 size={14} />}
        {mode === "create" ? "Register" : "Resubmit Amendment"}
      </button>
    </div>
  );
}

export default function ProviderRegistrationPage() {
  const { data: providers, isLoading } = useProviderOnboardings();
  const create = useCreateProviderOnboarding();
  const submit = useSubmitProviderForReview();
  const amend = useAmendProvider();

  // This system has exactly one FI tenant (same simplification every other
  // FI-facing page in this migration already makes) -- so the "my
  // registration" row is just the newest non-terminal row, if any.
  const activeRegistration = (providers ?? []).find((p) => p.status !== "Approved" && p.status !== "Rejected");

  if (isLoading) return <Layout title="Provider Registration"><p className="text-sm text-gray-500">Loading…</p></Layout>;

  return (
    <Layout title="Provider Registration">
      <div className="space-y-5 animate-fade-in">
        <p className="text-xs text-gray-500">
          Every institution must complete Stage 0 registration and be approved by vetify before it can offer financing on the platform.
        </p>

        {activeRegistration ? (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{activeRegistration.providerName}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{activeRegistration.cacRegNumber}</p>
              </div>
              <StatusBadge status={activeRegistration.status} size="sm" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 mb-4">
              <p><span className="text-gray-400">Type:</span> {activeRegistration.providerType}</p>
              <p><span className="text-gray-400">Instruments:</span> {activeRegistration.declaredInstruments.join(", ")}</p>
              {activeRegistration.agentScore != null && (
                <p><span className="text-gray-400">Score:</span> {activeRegistration.agentScore} ({activeRegistration.agentRisk})</p>
              )}
              {activeRegistration.agentNote && <p className="col-span-2"><span className="text-gray-400">Note:</span> {activeRegistration.agentNote}</p>}
            </div>

            {activeRegistration.status === "Draft" && (
              <button
                onClick={() => submit.mutate(activeRegistration.id)}
                disabled={submit.isPending}
                className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={14} />
                Submit for Review
              </button>
            )}

            {activeRegistration.status === "PendingAmendment" && (
              <RegistrationForm
                mode="amend"
                initial={{
                  providerName: activeRegistration.providerName,
                  address: activeRegistration.address,
                  cacRegNumber: activeRegistration.cacRegNumber,
                  providerType: activeRegistration.providerType,
                  licenseNumber: activeRegistration.licenseNumber,
                  declaredInstruments: activeRegistration.declaredInstruments,
                }}
                isPending={amend.isPending}
                onSubmit={async (args) =>
                  void (await amend.mutateAsync({
                    id: activeRegistration.id,
                    updatedProviderName: args.providerName,
                    updatedAddress: args.address,
                    updatedCacRegNumber: args.cacRegNumber,
                    updatedLicenseNumber: args.licenseNumber,
                    updatedGoverningDocRef: activeRegistration.governingDocRef,
                    updatedDeclaredInstruments: args.declaredInstruments,
                  }))
                }
              />
            )}

            {(activeRegistration.status === "UnderReview" || activeRegistration.status === "ManualReview") && (
              <p className="text-xs text-gray-400">Awaiting vetify review — no action needed.</p>
            )}
          </div>
        ) : (
          <RegistrationForm
            mode="create"
            isPending={create.isPending}
            onSubmit={async (args) => void (await create.mutateAsync({ ...args, governingDocRef: { docType: "GoverningDocument", contentHash: "pending-upload", storageRef: "local://pending" } }))}
          />
        )}
      </div>
    </Layout>
  );
}
