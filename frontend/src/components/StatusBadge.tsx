import type { ReviewStatus, FinancingStatus, MurabahahStatus, ShariahVerdict } from '../api/client'

type AnyStatus = ReviewStatus | FinancingStatus | MurabahahStatus | ShariahVerdict | string

const statusConfig: Record<string, { label: string; className: string }> = {
  // ReviewStatus
  Draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  Pending: { label: 'Pending', className: 'bg-blue-100 text-blue-700' },
  UnderReview: { label: 'Under Review', className: 'bg-indigo-100 text-indigo-700' },
  ManualReview: { label: 'Manual Review', className: 'bg-amber-100 text-amber-700' },
  PendingAmendment: { label: 'Pending Amendment', className: 'bg-orange-100 text-orange-700' },
  Approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
  Rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },

  // FinancingStatus
  Submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-700' },
  UnderwritingManualReview: { label: 'Manual Review', className: 'bg-amber-100 text-amber-700' },
  Underwriting: { label: 'Underwriting', className: 'bg-purple-100 text-purple-700' },
  FinancingApproved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
  FinancingRejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  Withdrawn: { label: 'Withdrawn', className: 'bg-gray-100 text-gray-600' },
  Expired: { label: 'Expired', className: 'bg-gray-100 text-gray-600' },
  Cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600' },

  // MurabahahStatus
  Active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700' },
  Delinquent: { label: 'Delinquent', className: 'bg-red-100 text-red-700' },
  Completed: { label: 'Completed', className: 'bg-teal-100 text-teal-700' },
  Defaulted: { label: 'Defaulted', className: 'bg-red-200 text-red-900' },
  DelinquencyManualReview: { label: 'Under Review', className: 'bg-amber-100 text-amber-700' },

  // ShariahVerdict
  COMPLIANT: { label: 'Compliant', className: 'bg-emerald-100 text-emerald-700' },
  REQUIRES_REVIEW: { label: 'Requires Review', className: 'bg-amber-100 text-amber-700' },
  NON_COMPLIANT: { label: 'Non-Compliant', className: 'bg-red-100 text-red-700' },

  // Repayment
  Paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-700' },
  Partial: { label: 'Partial', className: 'bg-amber-100 text-amber-700' },
  Late: { label: 'Late', className: 'bg-red-100 text-red-700' },

  // CollateralStatus (RahnAgreement)
  CollateralActive: { label: 'Active', className: 'bg-emerald-100 text-emerald-700' },
  CollateralReleased: { label: 'Released', className: 'bg-gray-100 text-gray-600' },
  CollateralEnforced: { label: 'Enforced', className: 'bg-red-100 text-red-700' },

  // EddCaseStatus (EDDCase — G14)
  EddOpen: { label: 'Open', className: 'bg-amber-100 text-amber-700' },
  EddClosed: { label: 'Closed', className: 'bg-emerald-100 text-emerald-700' },

  // BusinessStatus (ApprovedBusiness)
  BusinessActive: { label: 'Active', className: 'bg-emerald-100 text-emerald-700' },
  BusinessSuspended: { label: 'Suspended', className: 'bg-amber-100 text-amber-700' },
  BusinessExpired: { label: 'Expired', className: 'bg-gray-100 text-gray-600' },
}

interface Props {
  status: AnyStatus
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600',
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md ${config.className} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      {config.label}
    </span>
  )
}
