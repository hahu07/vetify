// Maps Postgres snake_case rows to the camelCase JSON shapes the ported
// frontend/ components expect. This is a normal, thin serialization step any
// real API does regardless of the DB's column-naming convention -- distinct
// from the old backend's Raw*/adapt* layer in frontend/src/api/client.ts,
// which existed specifically to undo the Daml v2 Ledger API's quirk of
// encoding Int/Decimal fields as JSON strings on both read and write.
// Postgres never had that problem, so there's nothing to "undo" here, only
// a field-name rename -- see the design-doc discussion in
// docs/web2-migration-design.md for why faking the old ledger's shape would
// have been the wrong choice.

export function serializeOnboarding(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    profile: row.profile,
    kyc: row.kyc,
    status: row.status,
    agentScore: row.agent_score ?? undefined,
    agentRisk: row.agent_risk ?? undefined,
    agentNote: row.agent_note ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    onboardingRef: row.onboarding_ref ?? undefined,
    documents: row.documents ?? [],
  };
}

export function serializeVerificationResult(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    businessName: row.business_name,
    cacRegNumber: row.cac_reg_number,
    outcome: row.outcome,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    autoDecided: row.auto_decided,
    verificationRef: row.verification_ref,
    decidedAt: row.decided_at,
    note: row.note ?? undefined,
  };
}

export function serializeComplianceReview(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    businessName: row.business_name,
    cacNumber: row.cac_reg_number,
    businessSector: row.business_sector,
    businessActivity: row.business_activity,
    verificationRef: row.verification_ref,
    complianceRef: row.compliance_ref,
    submittedAt: row.review_started_at ?? row.created_at,
    status: row.status,
    checks: row.checks ?? undefined,
    agentScore: row.agent_score ?? undefined,
    agentRisk: row.agent_risk ?? undefined,
  };
}

export function serializeComplianceResult(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    businessName: row.business_name,
    cacRegNumber: row.cac_reg_number,
    outcome: row.outcome,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    decidedAt: row.decided_at,
    verificationRef: row.verification_ref,
    complianceRef: row.compliance_ref,
    reason: row.reason ?? undefined,
  };
}

export function serializeApprovedBusiness(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    businessName: row.business_name,
    cacRegNumber: row.cac_reg_number,
    status: row.status,
    approvedAt: row.approved_at,
  };
}

// node-postgres returns NUMERIC columns as strings (deliberately, to avoid
// silent float rounding -- see addendum A in web2-migration-design.md).
// Converting to a JS number here is fine for a demo/PoC API response (no
// arithmetic happens in this conversion); real money arithmetic in the
// domain layer should still go through a decimal library, not this helper.
function num(value: unknown): number | undefined {
  return value == null ? undefined : Number(value);
}

export function serializeFinancingRequest(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    terms: {
      amount: num(row.terms_amount),
      purpose: row.terms_purpose,
      tenureMonths: row.terms_tenure_months,
    },
    status: row.status,
    financingRef: row.financing_ref,
    verificationRef: row.verification_ref ?? undefined,
    complianceRef: row.compliance_ref ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    businessSector: row.business_sector,
    agentScore: row.agent_score ?? undefined,
    agentRisk: row.agent_risk ?? undefined,
    agentNote: row.agent_note ?? undefined,
  };
}

export function serializeUnderwritingResult(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    financingRef: row.financing_ref,
    assessment: {
      score: row.assessment_score,
      riskCategory: row.assessment_risk_category,
      recommendedLimit: num(row.assessment_recommended_limit),
      recommendation: row.assessment_recommendation,
      probabilityOfDefault: num(row.assessment_probability_of_default),
      lossGivenDefault: num(row.assessment_loss_given_default),
      exposureAtDefault: num(row.assessment_exposure_at_default),
      behaviouralScore: row.assessment_behavioural_score ?? undefined,
      cashflowRiskScore: row.assessment_cashflow_risk_score ?? undefined,
      creditworthinessScore: row.assessment_creditworthiness_score ?? undefined,
      fraudScore: row.assessment_fraud_score ?? undefined,
    },
    autoDecided: row.auto_decided,
    underwritingStartedAt: row.underwriting_started_at ?? undefined,
    validUntil: row.valid_until ?? undefined,
  };
}

export function serializeUnderwritingRejection(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    financingRef: row.financing_ref,
    reason: row.reason,
    autoDecided: row.auto_decided,
    reviewerParty: row.reviewer_party ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    decidedAt: row.decided_at,
  };
}

export function serializeFinancingDecision(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    financingRef: row.financing_ref,
    outcome: row.outcome,
    reason: row.reason ?? undefined,
    decidedAt: row.decided_at,
    decidedByName: row.decided_by_name ?? undefined,
    reasonCode: row.reason_code ?? undefined,
    decisionFactors: row.decision_factors ?? [],
  };
}

export function serializeMurabahahWad(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    terms: { amount: num(row.terms_amount), purpose: row.terms_purpose, tenureMonths: row.terms_tenure_months },
    assetDetails: {
      description: row.asset_description,
      supplier: row.asset_supplier,
      supplierRef: row.asset_supplier_ref,
      estimatedCost: num(row.asset_estimated_cost),
    },
    financingRef: row.financing_ref ?? undefined,
  };
}

export function serializeMurabahahWakala(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahWadId: String(row.murabahah_wad_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    terms: { amount: num(row.terms_amount), purpose: row.terms_purpose, tenureMonths: row.terms_tenure_months },
    assetDetails: {
      description: row.asset_description,
      supplier: row.asset_supplier,
      supplierRef: row.asset_supplier_ref,
      estimatedCost: num(row.asset_estimated_cost),
    },
    agencyFee: num(row.agency_fee) ?? null,
    archivedAt: row.archived_at ?? null,
    supersededByKind: row.superseded_by_kind ?? null,
  };
}

export function serializeWadWithdrawalRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahWadId: String(row.murabahah_wad_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    reason: row.reason,
    withdrawnAt: row.withdrawn_at,
  };
}

export function serializeAgencyWithdrawalRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahWakalaId: String(row.murabahah_wakala_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    reason: row.reason,
    declinedAt: row.declined_at,
  };
}

export function serializeProposalDeclineRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahProposalId: String(row.murabahah_proposal_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    reason: row.reason,
    declinedAt: row.declined_at,
  };
}

export function serializeSupplierQuotation(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahWadId: String(row.murabahah_wad_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    supplierName: row.supplier_name,
    quotationRef: row.quotation_ref,
    quotedAmount: num(row.quoted_amount),
    assetDescription: row.asset_description,
    validUntil: row.valid_until ?? null,
  };
}

export function serializeCollateralValuationRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    rahnAgreementId: String(row.rahn_agreement_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    previousValue: num(row.previous_value),
    valuationAmount: num(row.valuation_amount),
    valuationDate: row.valuation_date,
    valuatorRef: row.valuator_ref,
    notes: row.notes ?? null,
  };
}

export function serializeCollateralInspectionRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    rahnAgreementId: String(row.rahn_agreement_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    inspectionDate: row.inspection_date,
    inspectedBy: row.inspected_by,
    condition: row.condition,
    inspectionNotes: row.inspection_notes ?? null,
    nextInspectionDate: row.next_inspection_date ?? null,
    mandateStatus: row.mandate_status ?? null,
    estimatedGsmRecoverable: num(row.estimated_gsm_recoverable) ?? null,
  };
}

export function serializeAssetPurchaseRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    terms: {
      amount: num(row.terms_amount),
      purpose: row.terms_purpose,
      tenureMonths: row.terms_tenure_months,
    },
    assetDescription: row.asset_description,
    actualCost: num(row.actual_cost),
    purchaseDate: row.purchase_date,
    invoiceRef: row.invoice_ref,
    totalAcquisitionCost: num(row.total_acquisition_cost),
    purchasedViaWakala: row.purchased_via_wakala,
    deliveryAcknowledged: row.delivery_acknowledged,
  };
}

export function serializeAssetRejectionRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    assetPurchaseRecordId: String(row.asset_purchase_record_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    reason: row.reason,
    defectDescription: row.defect_description,
    rejectedAt: row.rejected_at,
  };
}

export function serializeAcquisitionCancellationRequest(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    assetPurchaseRecordId: String(row.asset_purchase_record_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    reason: row.reason,
    status: row.status,
    resolvedAt: row.resolved_at ?? null,
  };
}

export function serializeMurabahahProposal(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    murabahahTerms: {
      assetCost: num(row.asset_cost),
      profitAmount: num(row.profit_amount),
      salePrice: num(row.sale_price),
      installmentAmount: num(row.installment_amount),
      tenureMonths: row.murabahah_tenure_months,
    },
    paymentSchedule: row.payment_schedule ?? [],
    startDate: row.start_date,
    acceptanceExpiresAt: row.acceptance_expires_at ?? undefined,
  };
}

export function serializeShariahContractCertification(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    certifiedSalePrice: num(row.certified_sale_price),
    certifiedAssetCost: num(row.certified_asset_cost),
    certifiedProfitAmount: num(row.certified_profit_amount),
    certifiedTenureMonths: row.certified_tenure_months,
    certificationRef: row.certification_ref,
    verdict: row.verdict,
    aaoifiStandards: row.aaoifi_standards ?? [],
    rationale: row.rationale,
    certifiedBy: row.certified_by,
    certifiedAt: row.certified_at,
  };
}

export function serializeMurabahahContract(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    murabahahTerms: {
      assetCost: num(row.asset_cost),
      profitAmount: num(row.profit_amount),
      salePrice: num(row.sale_price),
      installmentAmount: num(row.installment_amount),
      tenureMonths: row.murabahah_tenure_months,
    },
    startDate: row.start_date,
    outstandingBalance: num(row.outstanding_balance),
    installmentsPaid: row.installments_paid,
    pendingInstallmentPaid: num(row.pending_installment_paid),
    status: row.status,
    shariahCertificationRef: row.shariah_certification_ref,
    shariahCertifiedBy: row.shariah_certified_by,
    activeMoratorium: row.active_moratorium ?? undefined,
  };
}

// ─── Phase 2, third slice: Stage 9-10 (repayment lifecycle) ───────────────

export function serializeRepaymentRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    installmentNo: row.installment_no,
    dueDate: row.due_date,
    paymentDate: row.payment_date,
    amountPaid: num(row.amount_paid),
    remainingBalance: num(row.remaining_balance),
    wasLate: row.was_late,
  };
}

export function serializeLatePaymentCharity(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    repaymentRecordId: String(row.repayment_record_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    installmentNo: row.installment_no,
    dueDate: row.due_date,
    paymentDate: row.payment_date,
    charityAmount: num(row.charity_amount) ?? null,
    settled: row.settled,
  };
}

export function serializeAuditEvent(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    eventType: row.event_type,
    description: row.description,
    actedBy: row.acted_by,
    occurredAt: row.occurred_at,
  };
}

// ─── Phase 2, fourth slice: Reporting ──────────────────────────────────────

export function serializePortfolioReport(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    reportDate: row.report_date,
    totalActiveContracts: row.total_active_contracts,
    totalDisbursed: num(row.total_disbursed),
    totalOutstanding: num(row.total_outstanding),
    delinquentCount: row.delinquent_count,
    completedCount: row.completed_count,
    defaultedCount: row.defaulted_count,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

// ─── Phase 2, fifth slice: Ibra, LatePaymentCharity settlement, Default ────

export function serializeIbraRequest(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    outstandingBalance: num(row.outstanding_balance),
    requestedSettlementDate: row.requested_settlement_date,
    settlementType: row.settlement_type,
    requestedAmount: num(row.requested_amount) ?? null,
  };
}

export function serializeDefaultRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    reason: row.reason,
    defaultedBy: row.defaulted_by,
    defaultedAt: row.defaulted_at,
  };
}

// ─── Phase 2, sixth slice: RahnAgreement collateral ────────────────────────

export function serializeRahnAgreement(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    collateralDescription: row.collateral_description,
    collateralValue: num(row.collateral_value),
    collateralStatus: row.collateral_status,
    releaseEvidence: row.release_evidence ?? undefined,
  };
}

export function serializePendingCollateralEnforcement(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    rahnAgreementId: String(row.rahn_agreement_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    reason: row.reason,
    gsmExhausted: row.gsm_exhausted,
    gsmRef: row.gsm_ref ?? null,
    proposedByOfficerId: row.proposed_by_officer_id,
    status: row.status,
    resolvedAt: row.resolved_at ?? null,
  };
}

// ─── Phase 2, seventh slice: collateral valuation document upload ─────────

export function serializeCollateralValuationDocument(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    rahnAgreementId: String(row.rahn_agreement_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    valuatorRef: row.valuator_ref,
    valuationAmount: num(row.valuation_amount),
    valuationDate: row.valuation_date,
    notes: row.notes ?? undefined,
    docType: row.doc_type,
    contentHash: row.content_hash,
    storageRef: row.storage_ref,
    fileSize: row.file_size ?? undefined,
    uploadedAt: row.uploaded_at,
  };
}

// ─── Phase 2, eighth slice: restructuring + disputes/arbitration ──────────

export function serializeRestructuringRequest(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    outstandingBalance: num(row.outstanding_balance),
    proposedSchedule: row.proposed_schedule,
    reason: row.reason,
    requestDate: row.request_date,
  };
}

export function serializeRestructuringRejectionRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    restructuringRequestId: String(row.restructuring_request_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    reason: row.reason,
    rejectedAt: row.rejected_at,
  };
}

export function serializeDisputeRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    disputeType: row.dispute_type,
    description: row.description,
    evidenceRef: row.evidence_ref ?? undefined,
    raisedAt: row.raised_at,
    archived: row.archived_at != null,
  };
}

export function serializeArbitrationRequest(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    disputeRecordId: String(row.dispute_record_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    arbitrator: row.arbitrator,
    disputeDescription: row.dispute_description,
    escalatedAt: row.escalated_at,
    outcome: row.outcome ?? undefined,
    resolution: row.resolution ?? undefined,
  };
}

// ─── Phase 2, ninth slice: Collections (Direct Debit + GSM) ────────────────

export function serializeDirectDebitMandate(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    monoMandateRef: row.mono_mandate_ref,
    accountRef: row.account_ref,
    bankName: row.bank_name,
    maxCollectionAmount: num(row.max_collection_amount),
    frequency: row.frequency,
    mandateStartDate: row.mandate_start_date,
    mandateEndDate: row.mandate_end_date ?? undefined,
    gsmConsentGiven: row.gsm_consent_given,
    gsmConsentDate: row.gsm_consent_date ?? undefined,
    status: row.status,
  };
}

export function serializeDirectDebitCollectionAttempt(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    monoCollectionRef: row.mono_collection_ref,
    installmentNo: row.installment_no,
    attemptedAmount: num(row.attempted_amount),
    attemptDate: row.attempt_date,
    succeeded: row.succeeded,
    failureReason: row.failure_reason ?? undefined,
    retryCount: row.retry_count,
  };
}

export function serializeRecoveryPaymentRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    amountRecovered: num(row.amount_recovered),
    recoveryDate: row.recovery_date,
    recoverySource: row.recovery_source,
    remainingBalance: num(row.remaining_balance),
  };
}

export function serializeWriteOffRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    totalFinanced: num(row.total_financed),
    totalRecovered: num(row.total_recovered),
    amountWrittenOff: num(row.amount_written_off),
    writeOffDate: row.write_off_date,
    writeOffRef: row.write_off_ref,
    writeOffApprovedBy: row.write_off_approved_by,
    proposedByOfficerId: row.proposed_by_officer_id,
    confirmedByOfficerId: row.confirmed_by_officer_id,
  };
}

export function serializeDemandNotice(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    demandDate: row.demand_date,
    outstandingAmount: num(row.outstanding_amount),
    demandRef: row.demand_ref,
    responseDeadline: row.response_deadline,
    gsmEligible: row.gsm_eligible,
    archivedAt: row.archived_at ?? null,
    supersededByKind: row.superseded_by_kind ?? null,
    supersededById: row.superseded_by_id != null ? String(row.superseded_by_id) : null,
    withdrawalNote: row.withdrawal_note ?? null,
  };
}

export function serializeLegalEscalation(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    demandNoticeId: String(row.demand_notice_id),
    businessName: row.business_name,
    cacRegNumber: row.cac_reg_number,
    escalationDate: row.escalation_date,
    solicitorRef: row.solicitor_ref,
    legalAction: row.legal_action,
    outstandingAmount: num(row.outstanding_amount),
    courtRef: row.court_ref ?? null,
    resolvedAt: row.resolved_at ?? null,
  };
}

export function serializeGsmInvocation(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    businessBvn: row.business_bvn,
    invokedAmount: num(row.invoked_amount),
    monoGsmRef: row.mono_gsm_ref,
    invokedAt: row.invoked_at,
    status: row.status,
    lastSweepRef: row.last_sweep_ref ?? undefined,
  };
}

// ─── Phase 2, tenth slice: Moratorium + HamishJiddiyyah ───────────────────

export function serializeMoratoriumRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    moratoriumEnd: row.moratorium_end,
    reason: row.reason,
  };
}

export function serializeHamishJiddiyyah(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    murabahahContractId: String(row.murabahah_contract_id),
    facilityRef: row.facility_ref,
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    depositAmount: num(row.deposit_amount),
    depositRef: row.deposit_ref,
    depositDate: row.deposit_date,
    returnDeadline: row.return_deadline,
    actualLossDeducted: num(row.actual_loss_deducted) ?? undefined,
    status: row.status,
  };
}

export function serializeRegulatoryInspectionRequest(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    inspectionRef: row.inspection_ref,
    inspectionScope: row.inspection_scope,
    responseDeadline: row.response_deadline,
    requestedAt: row.requested_at,
    archivedAt: row.archived_at ?? null,
    supersededByKind: row.superseded_by_kind ?? null,
  };
}

export function serializeInspectionResponse(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    regulatoryInspectionRequestId: String(row.regulatory_inspection_request_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    inspectionRef: row.inspection_ref,
    responseRef: row.response_ref,
    documents: row.documents ?? [],
    respondedByName: row.responded_by_name,
    responseDate: row.response_date,
    archivedAt: row.archived_at ?? null,
    supersededByKind: row.superseded_by_kind ?? null,
  };
}

export function serializeInspectionRecord(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    inspectionResponseId: String(row.inspection_response_id),
    cacRegNumber: row.cac_reg_number,
    businessName: row.business_name,
    inspectionRef: row.inspection_ref,
    findings: row.findings ?? [],
    passed: row.passed,
    followUpNeeded: row.follow_up_needed,
    closingNote: row.closing_note,
  };
}

// ─── Phase 2, Eleventh Slice: Stage 0 (FinancingProviderOnboarding) ───────

export function serializeProviderOnboarding(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    providerName: row.provider_name,
    address: row.address,
    cacRegNumber: row.cac_reg_number,
    providerType: row.provider_type,
    regulatoryBody: row.regulatory_body ?? undefined,
    licenseNumber: row.license_number ?? undefined,
    governingDocRef: row.governing_doc_ref,
    declaredInstruments: row.declared_instruments ?? [],
    status: row.status,
    submittedAt: row.submitted_at ?? undefined,
    amendmentCount: row.amendment_count,
    agentScore: row.agent_score ?? undefined,
    agentRisk: row.agent_risk ?? undefined,
    agentNote: row.agent_note ?? undefined,
    agentVersion: row.agent_version ?? undefined,
  };
}

export function serializeApprovedProvider(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    financingProviderOnboardingId: String(row.financing_provider_onboarding_id),
    providerName: row.provider_name,
    providerType: row.provider_type,
    regulatoryBody: row.regulatory_body ?? undefined,
    licenseNumber: row.license_number ?? undefined,
    approvedInstruments: row.approved_instruments ?? [],
    approvedAt: row.approved_at,
    regulator: row.regulator ?? undefined,
  };
}

export function serializeProviderVerificationPolicy(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    policyVersion: row.policy_version,
    autoRejectMax: row.auto_reject_max,
    effectiveFrom: row.effective_from,
    scoringWeights: row.scoring_weights,
  };
}
