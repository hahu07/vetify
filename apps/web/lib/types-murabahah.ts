// Mirrors the Daml records in daml/Vetify/Types.daml consumed by the
// Murabahah acquisition-chain slice (Stage 8). Decimal fields get real
// NUMERIC columns in the schema (addendum A) -- these interfaces describe
// the request/response shape, not the DB row shape.

export interface AssetDetails {
  description: string;
  supplier: string;
  supplierRef: string;
  estimatedCost: number;
}

export interface MurabahahTerms {
  assetCost: number;
  profitAmount: number;
  salePrice: number;
  installmentAmount: number;
  tenureMonths: number;
  profitRate?: number | null;
  effectiveRate?: number | null;
}

export interface PaymentScheduleEntry {
  installmentNo: number;
  dueDate: string;
  dueAmount: number;
}
