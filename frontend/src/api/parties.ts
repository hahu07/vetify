// This demo has one seeded business and one seeded financial institution party
// (not one party per logged-in mock user — see auth/AuthContext.tsx, which is
// a login-UI simulation only, unrelated to Canton party identity). Every
// backend route already hardcodes which Canton party acts for a given choice
// (see backend/src/routes/*.ts's exerciseChoice(..., "business"/"verifier"/...)
// calls) — the frontend only needs a real Party ID string for the handful of
// payload fields that reference a party directly (e.g. BusinessOnboarding's
// `business` field). Set these to match whatever parties are allocated on the
// target ledger (see backend/.env.example's CANTON_*_PARTY_ID for the same
// values already configured server-side).
export const BUSINESS_PARTY_ID = import.meta.env.VITE_BUSINESS_PARTY_ID ?? 'Business::...'
export const VETIFY_PARTY_ID = import.meta.env.VITE_VETIFY_PARTY_ID ?? 'Vetify::...'
export const VERIFIER_PARTY_ID = import.meta.env.VITE_VERIFIER_PARTY_ID ?? 'Verifier::...'
export const FI_PARTY_ID = import.meta.env.VITE_FI_PARTY_ID ?? 'FinancialInstitution::...'
export const RISK_COMMITTEE_PARTY_ID = import.meta.env.VITE_RISK_COMMITTEE_PARTY_ID ?? 'RiskCommittee::...'
export const SENTINEL_PARTY_ID = import.meta.env.VITE_SENTINEL_PARTY_ID ?? 'Sentinel::...'
export const ADVISOR_PARTY_ID = import.meta.env.VITE_ADVISOR_PARTY_ID ?? 'Advisor::...'
export const ASSESSOR_PARTY_ID = import.meta.env.VITE_ASSESSOR_PARTY_ID ?? 'Assessor::...'
