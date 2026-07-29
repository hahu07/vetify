// Mirrors the Daml records in daml/Vetify/Types.daml consumed by this
// vertical slice. Field names match the Daml `data` records exactly so the
// jsonb columns storing them are a direct translation, not a reinterpretation.

export type BusinessType = "SoleProprietorship" | "LimitedCompany";
export type RiskLevel = "Low" | "Medium" | "High";

export interface BusinessDirector {
  name: string;
  address: string;
  phoneNumber: string;
  ninNumber: string;
  bvn: string;
  email: string;
}

export interface BusinessProfile {
  name: string;
  address: string;
  state: string;
  phoneNumber: string;
  email: string;
  website?: string | null;
  businessType: BusinessType;
  incorporationDate: string; // ISO date (YYYY-MM-DD)
  directors: BusinessDirector[];
  businessActivity: string;
  businessSector: string;
}

export interface BusinessKyc {
  cacRegNumber: string;
  taxId: string;
}

export interface DocumentRef {
  docType: string;
  contentHash: string;
  storageRef: string;
}

export interface VerificationChecks {
  identityVerified: boolean;
  cacRegistered: boolean;
  documentsValid: boolean;
  dataConsistent: boolean;
}

export interface ComplianceCheck {
  shariahCompliant: boolean;
  amlCleared: boolean;
  kycValidated: boolean;
  cddCompleted: boolean;
}
