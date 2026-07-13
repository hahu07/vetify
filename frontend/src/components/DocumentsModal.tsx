import { FileText, X, ExternalLink, AlertTriangle } from 'lucide-react'
import { useOnboardingDocuments, useDownloadDocument, type DocumentRef } from '../api/client'

// Mirrors the labels business/OnboardingForm.tsx's KycDocumentUpload shows at
// upload time, so a reviewer sees the same names the business did.
const DOC_TYPE_LABELS: Record<string, string> = {
  CAC_CERTIFICATE: 'CAC Registration Certificate',
  CAC_STATUS_REPORT: 'CAC Status Report',
  MEMART: 'Memorandum & Articles of Association',
  NIN_ID_CARD: "Director's ID Card (NIN)",
  OTHER: 'Other Supporting Document',
}

function filenameFromRef(storageRef: string): string {
  const last = storageRef.split('/').pop() ?? storageRef
  // Uploaded filenames are stored as "<uuid>-<original-name>" (documents.ts) —
  // strip the uuid prefix so the reviewer sees the name the business actually
  // uploaded, not an opaque identifier.
  return last.replace(/^[0-9a-f-]{36}-/i, '')
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface DocumentsModalProps {
  businessName: string
  cacRegNumber: string
  /** Pass when already in hand (e.g. the pipeline table's o.documents) to skip the by-CAC fetch. */
  documents?: DocumentRef[]
  onClose: () => void
}

export default function DocumentsModal({ businessName, cacRegNumber, documents: providedDocs, onClose }: DocumentsModalProps) {
  const shouldFetch = !providedDocs
  const { data, isLoading, isError } = useOnboardingDocuments(cacRegNumber, shouldFetch)
  const download = useDownloadDocument()

  const documents = providedDocs ?? data?.documents ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Documents</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {businessName} · <span className="font-mono">{cacRegNumber}</span>
        </p>

        {shouldFetch && isLoading && <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>}

        {shouldFetch && isError && (
          <div className="flex items-center gap-2 text-xs text-red-600 py-4">
            <AlertTriangle size={14} className="flex-shrink-0" />
            Failed to load documents
          </div>
        )}

        {(!shouldFetch || (!isLoading && !isError)) && documents.length === 0 && (
          <p className="text-xs text-gray-400 py-4 text-center">No documents on file</p>
        )}

        {documents.length > 0 && (
          <ul className="divide-y divide-gray-100 -mx-2">
            {documents.map((doc) => (
              <li key={doc.storageRef} className="flex items-center gap-3 px-2 py-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <FileText size={15} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-900">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {filenameFromRef(doc.storageRef)}
                    {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => download.mutate(doc)}
                  disabled={download.isPending}
                  className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  View <ExternalLink size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {download.isError && (
          <p className="text-xs text-red-600 mt-2">Failed to open document — it may no longer be available.</p>
        )}
      </div>
    </div>
  )
}
