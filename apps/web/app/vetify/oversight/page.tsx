"use client";

import { useState } from "react";
import { AlertTriangle, FileText, Siren, Bell, History, X } from "lucide-react";
import Layout from "@/components/Layout";
import { formatNaira, formatDate } from "@/lib/formatters";
import {
  useForceMajeureDeclarations,
  useCreateForceMajeureDeclaration,
  useLiftDeclaration,
  useMurabahahStatements,
  useCreateMurabahahStatement,
  useSarReports,
  useCreateSarReport,
  useMonitoringAlerts,
  useCreateMonitoringAlert,
  useDismissAlert,
  useAuditEvents,
  type ForceMajeureDeclarationItem,
  type MonitoringAlertItem,
} from "@/lib/apiClient";

// New page -- Phase 2, Forty-Third Slice. Groups five standalone vetify
// oversight record types (ForceMajeureDeclaration, MurabahahStatement,
// SarReport, MonitoringAlert, and the read-only AuditEvent trail) that don't
// individually warrant their own page -- all are simple create+list (plus
// one lifecycle action each for Force Majeure/Monitoring Alerts), same
// consolidation precedent as the Shariah Audits/Exceptions pair on
// /vetify/shariah-certification last slice.

function CreateForceMajeureModal({ onClose }: { onClose: () => void }) {
  const [declarationRef, setDeclarationRef] = useState(`FM-${Date.now()}`);
  const [eventDescription, setEventDescription] = useState("");
  const [affectedRegion, setAffectedRegion] = useState("");
  const [suspensionStart, setSuspensionStart] = useState(new Date().toISOString().slice(0, 10));
  const [suspensionEnd, setSuspensionEnd] = useState("");
  const [regulatoryBasis, setRegulatoryBasis] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateForceMajeureDeclaration();

  const handleSubmit = async () => {
    setError(null);
    if (!eventDescription.trim() || !affectedRegion.trim() || !suspensionEnd || !regulatoryBasis.trim()) {
      setError("All fields are required");
      return;
    }
    try {
      await create.mutateAsync({ declarationRef, eventDescription, affectedRegion, suspensionStart, suspensionEnd, regulatoryBasis });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the declaration");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Force Majeure Declaration</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Declaration Reference</label>
          <input className="input text-sm font-mono" value={declarationRef} onChange={(e) => setDeclarationRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Event Description</label>
          <textarea rows={2} className="input text-sm resize-none" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Flooding across the Southwest region" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Affected Region</label>
          <input className="input text-sm" value={affectedRegion} onChange={(e) => setAffectedRegion(e.target.value)} placeholder="Lagos, Ogun" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Suspension Start</label>
            <input type="date" className="input text-sm" value={suspensionStart} onChange={(e) => setSuspensionStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Suspension End</label>
            <input type="date" className="input text-sm" value={suspensionEnd} onChange={(e) => setSuspensionEnd(e.target.value)} />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Regulatory Basis</label>
          <input className="input text-sm" value={regulatoryBasis} onChange={(e) => setRegulatoryBasis(e.target.value)} placeholder="CBN Circular 2026/03" />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create Declaration"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LiftDeclarationModal({ declaration, onClose }: { declaration: ForceMajeureDeclarationItem; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lift = useLiftDeclaration();

  const handleSubmit = async () => {
    setError(null);
    if (!note.trim()) {
      setError("Please provide a note");
      return;
    }
    try {
      await lift.mutateAsync({ id: declaration.id, note });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to lift the declaration");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Lift Declaration</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{declaration.declarationRef}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Note</label>
          <textarea rows={2} className="input text-sm resize-none" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={lift.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {lift.isPending ? "Lifting…" : "Lift Declaration"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateStatementModal({ onClose }: { onClose: () => void }) {
  const [cacRegNumber, setCacRegNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [statementPeriod, setStatementPeriod] = useState("");
  const [totalFinanced, setTotalFinanced] = useState(0);
  const [totalRepaid, setTotalRepaid] = useState(0);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [installmentsPaid, setInstallmentsPaid] = useState(0);
  const [totalInstallments, setTotalInstallments] = useState(0);
  const [contractStatus, setContractStatus] = useState("Active");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateMurabahahStatement();

  const handleSubmit = async () => {
    setError(null);
    if (!cacRegNumber.trim() || !businessName.trim() || !statementPeriod.trim()) {
      setError("CAC number, business name, and statement period are required");
      return;
    }
    try {
      await create.mutateAsync({
        cacRegNumber, businessName, statementDate, statementPeriod, totalFinanced, totalRepaid,
        outstandingBalance, installmentsPaid, totalInstallments, contractStatus, shariahAuditRef: null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the statement");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Murabahah Statement</h2>
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
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Statement Date</label>
            <input type="date" className="input text-sm" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Statement Period</label>
            <input className="input text-sm" value={statementPeriod} onChange={(e) => setStatementPeriod(e.target.value)} placeholder="Q3 2026" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Total Financed (NGN)</label>
            <input type="number" className="input text-sm font-mono" value={totalFinanced} onChange={(e) => setTotalFinanced(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Total Repaid (NGN)</label>
            <input type="number" className="input text-sm font-mono" value={totalRepaid} onChange={(e) => setTotalRepaid(Number(e.target.value))} />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Outstanding Balance (NGN)</label>
          <input type="number" className="input text-sm font-mono" value={outstandingBalance} onChange={(e) => setOutstandingBalance(Number(e.target.value))} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Installments Paid</label>
            <input type="number" className="input text-sm font-mono" value={installmentsPaid} onChange={(e) => setInstallmentsPaid(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Total Installments</label>
            <input type="number" className="input text-sm font-mono" value={totalInstallments} onChange={(e) => setTotalInstallments(Number(e.target.value))} />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Contract Status</label>
          <select className="input text-sm" value={contractStatus} onChange={(e) => setContractStatus(e.target.value)}>
            <option value="Active">Active</option>
            <option value="Delinquent">Delinquent</option>
            <option value="Completed">Completed</option>
            <option value="Defaulted">Defaulted</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create Statement"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateSarModal({ onClose }: { onClose: () => void }) {
  const [cacRegNumber, setCacRegNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [sarRef, setSarRef] = useState(`SAR-${Date.now()}`);
  const [suspiciousActivity, setSuspiciousActivity] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportedByParty, setReportedByParty] = useState("");
  const [confidential, setConfidential] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateSarReport();

  const handleSubmit = async () => {
    setError(null);
    if (!cacRegNumber.trim() || !businessName.trim() || !suspiciousActivity.trim() || !reportedByParty.trim()) {
      setError("CAC number, business name, suspicious activity, and reporting party are required");
      return;
    }
    try {
      await create.mutateAsync({ cacRegNumber, businessName, sarRef, suspiciousActivity, reportDate, reportedByParty, confidential });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the SAR");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Suspicious Activity Report</h2>
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
          <label className="block text-xs font-medium text-gray-700 mb-1">SAR Reference</label>
          <input className="input text-sm font-mono" value={sarRef} onChange={(e) => setSarRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Suspicious Activity</label>
          <textarea rows={3} className="input text-sm resize-none" value={suspiciousActivity} onChange={(e) => setSuspiciousActivity(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Report Date</label>
            <input type="date" className="input text-sm" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reported By</label>
            <input className="input text-sm" value={reportedByParty} onChange={(e) => setReportedByParty(e.target.value)} placeholder="vetify" />
          </div>
        </div>
        <div className="mb-3">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
            <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} />
            Confidential (default)
          </label>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create SAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateAlertModal({ onClose }: { onClose: () => void }) {
  const [cacRegNumber, setCacRegNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [facilityRef, setFacilityRef] = useState("");
  const [alertType, setAlertType] = useState("DelinquencyRisk");
  const [alertSeverity, setAlertSeverity] = useState("SeverityMedium");
  const [alertDescription, setAlertDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateMonitoringAlert();

  const handleSubmit = async () => {
    setError(null);
    if (!cacRegNumber.trim() || !businessName.trim() || !alertType.trim() || !alertDescription.trim()) {
      setError("CAC number, business name, alert type, and description are required");
      return;
    }
    try {
      await create.mutateAsync({ cacRegNumber, businessName, facilityRef: facilityRef || null, alertType, alertSeverity, alertDescription });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the alert");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Monitoring Alert</h2>
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
          <label className="block text-xs font-medium text-gray-700 mb-1">Facility Reference (optional)</label>
          <input className="input text-sm font-mono" value={facilityRef} onChange={(e) => setFacilityRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Alert Type</label>
          <select className="input text-sm" value={alertType} onChange={(e) => setAlertType(e.target.value)}>
            <option value="DelinquencyRisk">Delinquency Risk</option>
            <option value="CollateralDeterioration">Collateral Deterioration</option>
            <option value="AMLFlag">AML Flag</option>
            <option value="FraudSignal">Fraud Signal</option>
            <option value="SupplierRisk">Supplier Risk</option>
            <option value="EarlyWarningSignal">Early Warning Signal</option>
            <option value="MandateCancellation">Mandate Cancellation</option>
            <option value="GSMExhausted">GSM Exhausted</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Severity</label>
          <select className="input text-sm" value={alertSeverity} onChange={(e) => setAlertSeverity(e.target.value)}>
            <option value="SeverityLow">Low</option>
            <option value="SeverityMedium">Medium</option>
            <option value="SeverityHigh">High</option>
            <option value="SeverityCritical">Critical</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea rows={2} className="input text-sm resize-none" value={alertDescription} onChange={(e) => setAlertDescription(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create Alert"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: MonitoringAlertItem }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dismiss = useDismissAlert();

  const handleDismiss = async () => {
    setError(null);
    if (!note.trim()) {
      setError("Please provide a dismissal note");
      return;
    }
    try {
      await dismiss.mutateAsync({ id: alert.id, dismissNote: note });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to dismiss the alert");
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{alert.businessName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{alert.alertType} · <span className="font-medium">{alert.alertSeverity}</span></p>
          <p className="text-xs text-gray-600 mt-0.5">{alert.alertDescription}</p>
        </div>
        {alert.dismissed && <span className="text-xs text-emerald-600 flex-shrink-0">Dismissed</span>}
      </div>
      {!alert.dismissed && (
        <div className="grid grid-cols-[1fr_auto] gap-2 mt-2">
          <input className="input text-xs" placeholder="Dismissal note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={handleDismiss} disabled={dismiss.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
            {dismiss.isPending ? "Dismissing…" : "Dismiss"}
          </button>
        </div>
      )}
      {alert.dismissalNote && <p className="text-xs text-gray-400 mt-2">{alert.dismissalNote}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export default function VetifyOversightPage() {
  const { data: declarations } = useForceMajeureDeclarations();
  const { data: statements } = useMurabahahStatements();
  const { data: sarReports } = useSarReports();
  const { data: alerts } = useMonitoringAlerts();
  const { data: auditEvents } = useAuditEvents();
  const [fmModalOpen, setFmModalOpen] = useState(false);
  const [liftModal, setLiftModal] = useState<ForceMajeureDeclarationItem | null>(null);
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [sarModalOpen, setSarModalOpen] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);

  return (
    <Layout title="Compliance Oversight">
      <div className="space-y-6">
        <p className="text-xs text-gray-500">
          Standalone vetify oversight records: Force Majeure declarations, Murabahah statements, Suspicious Activity Reports, and
          delinquency-monitoring alerts, plus the read-only audit trail.
        </p>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Force Majeure Declarations</h2>
            </div>
            <button onClick={() => setFmModalOpen(true)} className="btn-secondary text-xs px-3 py-1.5">New Declaration</button>
          </div>
          <div className="card overflow-hidden">
            {(declarations ?? []).length === 0 ? (
              <div className="py-10 text-center"><p className="text-sm text-gray-400">No declarations recorded</p></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(declarations ?? []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 font-mono">{d.declarationRef}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{d.eventDescription}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{d.affectedRegion} · {formatDate(d.suspensionStart)} – {formatDate(d.suspensionEnd)}</p>
                    </div>
                    {d.isActive ? (
                      <button onClick={() => setLiftModal(d)} className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0">Lift</button>
                    ) : (
                      <span className="text-xs text-gray-400 flex-shrink-0">Lifted</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Murabahah Statements</h2>
            </div>
            <button onClick={() => setStatementModalOpen(true)} className="btn-secondary text-xs px-3 py-1.5">New Statement</button>
          </div>
          <div className="card overflow-hidden">
            {(statements ?? []).length === 0 ? (
              <div className="py-10 text-center"><p className="text-sm text-gray-400">No statements generated yet</p></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(statements ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{s.businessName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.statementPeriod} · {s.installmentsPaid}/{s.totalInstallments} installments · <span className="font-mono">{s.contractStatus}</span></p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono text-gray-900">{formatNaira(s.outstandingBalance)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">outstanding</p>
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
              <Siren size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Suspicious Activity Reports</h2>
            </div>
            <button onClick={() => setSarModalOpen(true)} className="btn-danger text-xs px-3 py-1.5">New SAR</button>
          </div>
          <div className="card overflow-hidden">
            {(sarReports ?? []).length === 0 ? (
              <div className="py-10 text-center"><p className="text-sm text-gray-400">No SARs filed</p></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(sarReports ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 font-mono">{s.sarRef}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.businessName}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{s.suspiciousActivity}</p>
                    </div>
                    {s.confidential && <span className="text-xs text-gray-400 flex-shrink-0">Confidential</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Monitoring Alerts</h2>
            </div>
            <button onClick={() => setAlertModalOpen(true)} className="btn-secondary text-xs px-3 py-1.5">New Alert</button>
          </div>
          <div className="card overflow-hidden">
            {(alerts ?? []).length === 0 ? (
              <div className="py-10 text-center"><p className="text-sm text-gray-400">No alerts recorded</p></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(alerts ?? []).map((a) => <AlertRow key={a.id} alert={a} />)}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <History size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Audit Trail</h2>
          </div>
          <div className="card overflow-hidden">
            {(auditEvents ?? []).length === 0 ? (
              <div className="py-10 text-center"><p className="text-sm text-gray-400">No audit events recorded</p></div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {(auditEvents ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-4 p-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">{e.eventType} — {e.businessName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{e.description}</p>
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0">{formatDate(e.occurredAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {fmModalOpen && <CreateForceMajeureModal onClose={() => setFmModalOpen(false)} />}
      {liftModal && <LiftDeclarationModal declaration={liftModal} onClose={() => setLiftModal(null)} />}
      {statementModalOpen && <CreateStatementModal onClose={() => setStatementModalOpen(false)} />}
      {sarModalOpen && <CreateSarModal onClose={() => setSarModalOpen(false)} />}
      {alertModalOpen && <CreateAlertModal onClose={() => setAlertModalOpen(false)} />}
    </Layout>
  );
}
