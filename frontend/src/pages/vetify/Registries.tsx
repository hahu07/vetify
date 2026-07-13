import { useState } from 'react'
import { ChevronDown, ChevronUp, UserPlus, BookOpen, ClipboardCheck, ShieldCheck, FileSignature } from 'lucide-react'
import Layout from '../../components/Layout'
import AmountDisplay from '../../components/AmountDisplay'
import {
  useAuthorizedAdvisors, useRegisterAdvisor, useDeactivateAdvisor, useReactivateAdvisor,
  useAuthorizedAssessors, useRegisterAssessor, useDeactivateAssessor, useReactivateAssessor,
  useAuthorizedReviewers, useRegisterReviewer, useDeauthorizeReviewer,
  useProposals, useShariahCertifications, useCertifyShariahTerms, useRevokeCertification,
} from '../../api/client'
import type { MurabahahProposal } from '../../api/client'
import { VETIFY_PARTY_ID, ADVISOR_PARTY_ID, ASSESSOR_PARTY_ID, VERIFIER_PARTY_ID } from '../../api/parties'

interface ActiveRegistrant {
  id: string
  role: string
  active: boolean
}

function ActiveDeactivateRow<T extends ActiveRegistrant>({
  entry, partyLabel, onDeactivate, onReactivate,
}: {
  entry: T
  partyLabel: string
  onDeactivate: (id: string) => void
  onReactivate: (id: string) => void
}) {
  return (
    <tr>
      <td className="font-mono text-xs">{partyLabel}</td>
      <td className="text-xs text-gray-600">{entry.role}</td>
      <td>
        <span className={`text-xs font-medium ${entry.active ? 'text-emerald-600' : 'text-gray-400'}`}>
          {entry.active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="text-right">
        {entry.active ? (
          <button onClick={() => onDeactivate(entry.id)} className="text-xs text-red-600 hover:underline">
            Deactivate
          </button>
        ) : (
          <button onClick={() => onReactivate(entry.id)} className="text-xs text-primary hover:underline">
            Reactivate
          </button>
        )}
      </td>
    </tr>
  )
}

function AdvisorSection() {
  const [open, setOpen] = useState(false)
  const { data: advisors, isLoading } = useAuthorizedAdvisors()
  const register = useRegisterAdvisor()
  const deactivate = useDeactivateAdvisor()
  const reactivate = useReactivateAdvisor()

  const [party, setParty] = useState(ADVISOR_PARTY_ID)
  const [role, setRole] = useState('')
  const [authorizedBy, setAuthorizedBy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleRegister = async () => {
    setError(null)
    if (!role.trim() || !authorizedBy.trim()) {
      setError('Role and Authorized By are required')
      return
    }
    try {
      await register.mutateAsync({ vetify: VETIFY_PARTY_ID, advisor: party, role, authorizedBy })
      setRole('')
      setAuthorizedBy('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register advisor')
    }
  }

  return (
    <div className="card p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <BookOpen size={15} className="text-primary" />
          Shari'a Advisor Registry
        </h2>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <p className="text-xs text-gray-500 mb-2">
        Gates who may exercise <code className="font-mono">RecordShariahPreCheck</code> and{' '}
        <code className="font-mono">CertifyShariahTerms</code> as the independent Shari'a Supervisory Board.
      </p>
      {open && (
        <div className="space-y-4 mt-2">
          {isLoading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Advisor Party</th><th>Role</th><th>Status</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {(advisors ?? []).map((a) => (
                  <ActiveDeactivateRow
                    key={a.id}
                    entry={a}
                    partyLabel={a.advisor}
                    onDeactivate={(id) => deactivate.mutate({ id, reason: 'Deactivated by admin', performedBy: 'Vetify Admin' })}
                    onReactivate={(id) => reactivate.mutate({ id, reason: 'Reactivated by admin', performedBy: 'Vetify Admin' })}
                  />
                ))}
              </tbody>
            </table>
          )}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <input className="input text-sm font-mono" placeholder="Advisor party ID" value={party} onChange={(e) => setParty(e.target.value)} />
            <input className="input text-sm" placeholder="Role (e.g. Fiqh Scholar)" value={role} onChange={(e) => setRole(e.target.value)} />
            <input className="input text-sm" placeholder="Authorized by" value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} />
            {error && <p className="text-xs text-red-600 col-span-3">{error}</p>}
            <button onClick={handleRegister} disabled={register.isPending} className="btn-primary text-sm col-span-3 flex items-center justify-center gap-2 disabled:opacity-50">
              <UserPlus size={14} />
              Register Advisor
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AssessorSection() {
  const [open, setOpen] = useState(false)
  const { data: assessors, isLoading } = useAuthorizedAssessors()
  const register = useRegisterAssessor()
  const deactivate = useDeactivateAssessor()
  const reactivate = useReactivateAssessor()

  const [party, setParty] = useState(ASSESSOR_PARTY_ID)
  const [role, setRole] = useState('')
  const [authorizedBy, setAuthorizedBy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleRegister = async () => {
    setError(null)
    if (!role.trim() || !authorizedBy.trim()) {
      setError('Role and Authorized By are required')
      return
    }
    try {
      await register.mutateAsync({ vetify: VETIFY_PARTY_ID, assessor: party, role, authorizedBy })
      setRole('')
      setAuthorizedBy('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register assessor')
    }
  }

  return (
    <div className="card p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ClipboardCheck size={15} className="text-primary" />
          Underwriting Assessor Registry
        </h2>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <p className="text-xs text-gray-500 mb-2">
        Gates who may exercise <code className="font-mono">BeginUnderwriting</code>/
        <code className="font-mono">RejectUnderwriting</code> as Stage 6's underwriting authority.
      </p>
      {open && (
        <div className="space-y-4 mt-2">
          {isLoading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Assessor Party</th><th>Role</th><th>Status</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {(assessors ?? []).map((a) => (
                  <ActiveDeactivateRow
                    key={a.id}
                    entry={a}
                    partyLabel={a.assessor}
                    onDeactivate={(id) => deactivate.mutate({ id, reason: 'Deactivated by admin', performedBy: 'Vetify Admin' })}
                    onReactivate={(id) => reactivate.mutate({ id, reason: 'Reactivated by admin', performedBy: 'Vetify Admin' })}
                  />
                ))}
              </tbody>
            </table>
          )}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <input className="input text-sm font-mono" placeholder="Assessor party ID" value={party} onChange={(e) => setParty(e.target.value)} />
            <input className="input text-sm" placeholder="Role (e.g. Senior Assessor)" value={role} onChange={(e) => setRole(e.target.value)} />
            <input className="input text-sm" placeholder="Authorized by" value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} />
            {error && <p className="text-xs text-red-600 col-span-3">{error}</p>}
            <button onClick={handleRegister} disabled={register.isPending} className="btn-primary text-sm col-span-3 flex items-center justify-center gap-2 disabled:opacity-50">
              <UserPlus size={14} />
              Register Assessor
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewerSection() {
  const [open, setOpen] = useState(false)
  const { data: reviewers, isLoading } = useAuthorizedReviewers()
  const register = useRegisterReviewer()
  const deauthorize = useDeauthorizeReviewer()

  const [party, setParty] = useState(VERIFIER_PARTY_ID)
  const [role, setRole] = useState('')
  const [authorizedBy, setAuthorizedBy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleRegister = async () => {
    setError(null)
    if (!role.trim() || !authorizedBy.trim()) {
      setError('Role and Authorized By are required')
      return
    }
    try {
      await register.mutateAsync({ vetify: VETIFY_PARTY_ID, verifier: party, role, authorizedBy })
      setRole('')
      setAuthorizedBy('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register reviewer')
    }
  }

  return (
    <div className="card p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ShieldCheck size={15} className="text-primary" />
          Compliance Reviewer Registry
        </h2>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <p className="text-xs text-gray-500 mb-2">
        Gates who may exercise <code className="font-mono">ApproveCompliance</code>/
        <code className="font-mono">RejectCompliance</code> as <code className="font-mono">verifier</code>.
        Deauthorize-only — this registry has no reactivate; re-register to restore access.
      </p>
      {open && (
        <div className="space-y-4 mt-2">
          {isLoading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Verifier Party</th><th>Role</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {(reviewers ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.verifier}</td>
                    <td className="text-xs text-gray-600">{r.role}</td>
                    <td className="text-right">
                      <button
                        onClick={() => deauthorize.mutate({ id: r.id, reason: 'Deauthorized by admin' })}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Deauthorize
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <input className="input text-sm font-mono" placeholder="Verifier party ID" value={party} onChange={(e) => setParty(e.target.value)} />
            <input className="input text-sm" placeholder="Role (e.g. Senior Compliance Officer)" value={role} onChange={(e) => setRole(e.target.value)} />
            <input className="input text-sm" placeholder="Authorized by" value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} />
            {error && <p className="text-xs text-red-600 col-span-3">{error}</p>}
            <button onClick={handleRegister} disabled={register.isPending} className="btn-primary text-sm col-span-3 flex items-center justify-center gap-2 disabled:opacity-50">
              <UserPlus size={14} />
              Register Reviewer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// G11: per-contract Shari'a sign-off — certifies a specific MurabahahProposal's
// disclosed cost/profit/sale-price/tenure before AcceptProposal will allow the
// business to execute. No advisor portal exists (see auth/AuthContext.tsx's
// UserRole), so this is exercised from the vetify session, which already acts
// as [advisor, vetify] server-side (backend/src/routes/financing.ts).
function CertificationSection() {
  const [open, setOpen] = useState(false)
  const { data: proposals, isLoading: loadingProposals } = useProposals()
  const { data: certifications, isLoading: loadingCerts } = useShariahCertifications()
  const certify = useCertifyShariahTerms()
  const revoke = useRevokeCertification()

  const [certModal, setCertModal] = useState<MurabahahProposal | null>(null)
  const [certForm, setCertForm] = useState({ certificationRef: '', aaoifiStandards: 'Std No. 8, Std No. 40', rationale: '', certifiedBy: '' })
  const [error, setError] = useState<string | null>(null)

  const certifiedFacilityRefs = new Set((certifications ?? []).filter((c) => c.verdict === 'COMPLIANT').map((c) => c.facilityRef))
  const uncertified = (proposals ?? []).filter((p) => !certifiedFacilityRefs.has(p.facilityRef))

  const handleCertify = async () => {
    if (!certModal) return
    setError(null)
    if (!certForm.certificationRef.trim() || !certForm.rationale.trim() || !certForm.certifiedBy.trim()) {
      setError('Certification reference, rationale, and certified-by are required')
      return
    }
    try {
      await certify.mutateAsync({
        id: certModal.id,
        certificationRef: certForm.certificationRef,
        aaoifiStandards: certForm.aaoifiStandards.split(',').map((s) => s.trim()).filter(Boolean),
        rationale: certForm.rationale,
        certifiedBy: certForm.certifiedBy,
      })
      setCertModal(null)
      setCertForm({ certificationRef: '', aaoifiStandards: 'Std No. 8, Std No. 40', rationale: '', certifiedBy: '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to certify Shari\'a terms')
    }
  }

  const handleRevoke = (id: string, certifiedBy: string) => {
    revoke.mutate({ id, revocationRef: `REV-${Date.now()}`, reason: 'Terms changed — revoked pending re-certification', revokedBy: certifiedBy })
  }

  return (
    <div className="card p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FileSignature size={15} className="text-primary" />
          Shari'a Contract Certification
        </h2>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <p className="text-xs text-gray-500 mb-2">
        The Shari'a Supervisory Board's per-contract sign-off (G11, AAOIFI GSIFI No. 1/2) — a proposal's
        disclosed cost/profit/sale-price/tenure must be certified <code className="font-mono">COMPLIANT</code>{' '}
        before the business can accept it.
      </p>
      {open && (
        <div className="space-y-4 mt-2">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">Awaiting Certification ({uncertified.length})</p>
            {loadingProposals ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : uncertified.length === 0 ? (
              <p className="text-xs text-gray-400">No proposals awaiting certification</p>
            ) : (
              <div className="space-y-2">
                {uncertified.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-gray-800">{p.facilityRef} — {p.businessName}</p>
                      <p className="text-xs text-gray-500">
                        Sale price <AmountDisplay amount={p.murabahahTerms.salePrice} className="inline text-xs" /> over {p.murabahahTerms.tenureMonths} months
                      </p>
                    </div>
                    <button onClick={() => setCertModal(p)} className="btn-primary text-xs">Certify Terms</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-1.5">Issued Certifications ({(certifications ?? []).length})</p>
            {loadingCerts ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : (certifications ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">None issued yet</p>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Facility</th><th>Verdict</th><th>Certified By</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {(certifications ?? []).map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono text-xs">{c.facilityRef}</td>
                      <td>
                        <span className={`text-xs font-medium ${c.verdict === 'COMPLIANT' ? 'text-emerald-600' : 'text-red-600'}`}>{c.verdict}</span>
                      </td>
                      <td className="text-xs text-gray-600">{c.certifiedBy}</td>
                      <td className="text-right">
                        <button onClick={() => handleRevoke(c.id, c.certifiedBy)} disabled={revoke.isPending} className="text-xs text-red-600 hover:underline disabled:opacity-40">
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {certModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCertModal(null)} />
          <div className="relative card p-6 w-full max-w-md animate-fade-in space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Certify Shari'a Terms</h2>
            <p className="text-xs text-gray-500">
              {certModal.facilityRef} — sale price <AmountDisplay amount={certModal.murabahahTerms.salePrice} className="inline text-xs" />,{' '}
              profit <AmountDisplay amount={certModal.murabahahTerms.profit} className="inline text-xs" />, {certModal.murabahahTerms.tenureMonths} months.
            </p>
            <div>
              <label className="text-xs text-gray-500">Certification Reference</label>
              <input className="input text-sm" value={certForm.certificationRef}
                onChange={(e) => setCertForm((f) => ({ ...f, certificationRef: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">AAOIFI Standards (comma-separated)</label>
              <input className="input text-sm" value={certForm.aaoifiStandards}
                onChange={(e) => setCertForm((f) => ({ ...f, aaoifiStandards: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Rationale</label>
              <textarea rows={3} className="input resize-none text-sm" value={certForm.rationale}
                onChange={(e) => setCertForm((f) => ({ ...f, rationale: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Certified By (SSB member name)</label>
              <input className="input text-sm" value={certForm.certifiedBy}
                onChange={(e) => setCertForm((f) => ({ ...f, certifiedBy: e.target.value }))} />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setCertModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCertify} disabled={certify.isPending} className="btn-primary flex-1 disabled:opacity-40">
                {certify.isPending ? 'Certifying…' : 'Certify COMPLIANT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Registries() {
  return (
    <Layout title="Authorization Registries">
      <div className="space-y-5 max-w-4xl">
        <p className="text-xs text-gray-500">
          Registries gating who may act as verifier/assessor/advisor on-ledger — separate from the
          Policy Approver and Sentinel registries (Policy Governance / Delinquency Monitoring pages).
        </p>
        <AdvisorSection />
        <AssessorSection />
        <ReviewerSection />
        <CertificationSection />
      </div>
    </Layout>
  )
}
