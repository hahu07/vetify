// Ported verbatim from frontend/src/components/StatusBadge.tsx -- pure
// presentational component, no data-layer dependency, so no adaptation needed.

type AnyStatus = string;

const statusConfig: Record<string, { label: string; className: string }> = {
  Draft: { label: "Draft", className: "bg-gray-100 text-gray-600" },
  Pending: { label: "Pending", className: "bg-blue-100 text-blue-700" },
  UnderReview: { label: "Under Review", className: "bg-indigo-100 text-indigo-700" },
  ManualReview: { label: "Manual Review", className: "bg-amber-100 text-amber-700" },
  PendingAmendment: { label: "Pending Amendment", className: "bg-orange-100 text-orange-700" },
  Approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  Rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },

  BusinessActive: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  BusinessSuspended: { label: "Suspended", className: "bg-amber-100 text-amber-700" },
  BusinessExpired: { label: "Expired", className: "bg-gray-100 text-gray-600" },

  Submitted: { label: "Submitted", className: "bg-blue-100 text-blue-700" },
  Underwriting: { label: "Underwriting", className: "bg-indigo-100 text-indigo-700" },
  UnderwritingManualReview: { label: "Manual Review", className: "bg-amber-100 text-amber-700" },
  FinancingApproved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  FinancingRejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
};

interface Props {
  status: AnyStatus;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: Props) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md ${config.className} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      {config.label}
    </span>
  );
}
