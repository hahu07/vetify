"use client";

import { useState } from "react";
import { FileCheck, CheckCircle2, Ban } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { useDocumentEntries, useVerifyDocument, type DocumentEntry } from "@/lib/apiClient";

// New page -- Phase 2, Fortieth Slice. VerifyDocument's Daml controller is
// `vetify` alone (an independent back-office check on FI-registered
// acquisition documents), so it needs its own vetify-facing page -- no
// existing vetify page tracks AssetPurchaseRecord-adjacent documents.
// RegisterDocument/SupersedeDocument (financialInstitution-controlled) live
// on /fi/acquisition instead.

function VerifyRow({ entry }: { entry: DocumentEntry }) {
  const [error, setError] = useState<string | null>(null);
  const verify = useVerifyDocument();

  const handleVerify = async () => {
    setError(null);
    try {
      await verify.mutateAsync({ id: entry.id, verifyNote: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify the document");
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{entry.businessName}</p>
        <p className="text-xs text-gray-500 mt-0.5 font-mono">{entry.documentRef.docType} · {entry.documentRef.storageRef}</p>
        <p className="text-xs text-gray-400 mt-0.5">Registered by {entry.registeredBy}</p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button onClick={handleVerify} disabled={verify.isPending} className="btn-primary text-xs px-3 py-1.5 flex-shrink-0 disabled:opacity-40">
        {verify.isPending ? "Verifying…" : "Verify"}
      </button>
    </div>
  );
}

export default function VetifyDocumentsPage() {
  const { data: entries, isLoading, isError } = useDocumentEntries();

  if (isLoading) return <Layout title="Document Verification"><FullPageLoader /></Layout>;
  if (isError || !entries) return <Layout title="Document Verification"><ErrorState message="Failed to load document entries" /></Layout>;

  const pending = entries.filter((e) => !e.verifiedAt && !e.superseded);
  const verified = entries.filter((e) => e.verifiedAt && !e.superseded);
  const superseded = entries.filter((e) => e.superseded);

  return (
    <Layout title="Document Verification">
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          Independent back-office verification of acquisition documents (invoices, bills of lading, ownership titles) registered
          by the financial institution against an <code>AssetPurchaseRecord</code>.
        </p>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileCheck size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Pending Verification</h2>
          </div>
          <div className="card overflow-hidden">
            {pending.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No documents awaiting verification</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pending.map((entry) => (
                  <VerifyRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>

        {verified.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Verified</h2>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {verified.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{entry.businessName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{entry.documentRef.docType} · {entry.documentRef.storageRef}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex-shrink-0">
                    <CheckCircle2 size={12} /> Verified
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {superseded.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Superseded</h2>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {superseded.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{entry.businessName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{entry.documentRef.docType} · {entry.documentRef.storageRef}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full flex-shrink-0">
                    <Ban size={12} /> Superseded
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
