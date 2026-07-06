// This demo has one seeded borrower and one seeded financial institution party
// (not one party per logged-in mock user — see auth/AuthContext.tsx, which is
// a login-UI simulation only, unrelated to Canton party identity). Every
// backend route already hardcodes which Canton party acts for a given choice
// (see backend/src/routes/*.ts's exerciseChoice(..., "borrower"/"verifier"/...)
// calls) — the frontend only needs a real Party ID string for the handful of
// payload fields that reference a party directly (e.g. BusinessOnboarding's
// `borrower` field). Set these to match whatever parties are allocated on the
// target ledger (see backend/.env.example's CANTON_*_PARTY_ID for the same
// values already configured server-side).
export const BORROWER_PARTY_ID = import.meta.env.VITE_BORROWER_PARTY_ID ?? 'Borrower::...'
export const VETIFY_PARTY_ID = import.meta.env.VITE_VETIFY_PARTY_ID ?? 'Vetify::...'
export const VERIFIER_PARTY_ID = import.meta.env.VITE_VERIFIER_PARTY_ID ?? 'Verifier::...'
export const FI_PARTY_ID = import.meta.env.VITE_FI_PARTY_ID ?? 'FinancialInstitution::...'
export const RISK_COMMITTEE_PARTY_ID = import.meta.env.VITE_RISK_COMMITTEE_PARTY_ID ?? 'RiskCommittee::...'
