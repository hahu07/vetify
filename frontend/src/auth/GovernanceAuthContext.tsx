import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import axios from 'axios'

// See ../auth/AuthContext.tsx's identical comment: this file's
// useGovernanceAuth() hook lives alongside its Provider deliberately.
/* eslint-disable react-refresh/only-export-components */

/**
 * Layer 3 of the Policy-Approval Security Roadmap: a real human login for
 * governance-critical actions (endorse/approve/reject a scoring-policy
 * change), completely separate from the app's role-based mock login in
 * ../auth/AuthContext.tsx.
 *
 * That context picks which *portal* (business/financer/vetify/riskCommittee)
 * to show — it's a UI convenience, not tied to any real identity. This
 * context authenticates a specific *person* against the backend's own user
 * table (backend/src/appdb.ts), independent of which shared Canton party
 * JWT eventually submits the ledger transaction. See policy.ts's doc
 * comment for why this two-layer model is what actually proves individual
 * accountability, not just a name typed into a text box.
 *
 * Layer 4 (TOTP MFA): `login()` throws MfaRequiredError when the account has
 * MFA enabled — the caller must then collect a 6-digit code and call
 * `verifyMfaCode`. No real session exists until that second step succeeds.
 */

export interface GovernanceSession {
  token: string
  displayName: string
  partyRole: string
}

export class MfaRequiredError extends Error {
  constructor(public mfaToken: string) {
    super('MFA code required')
    this.name = 'MfaRequiredError'
  }
}

interface GovernanceAuthValue {
  session: GovernanceSession | null
  login: (username: string, password: string) => Promise<void>
  verifyMfaCode: (mfaToken: string, code: string) => Promise<void>
  logout: () => void
}

const STORAGE_KEY = 'vetify_governance_session'
const GovernanceAuthContext = createContext<GovernanceAuthValue | null>(null)

function rehydrate(): GovernanceSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as GovernanceSession) : null
  } catch {
    return null
  }
}

function storeSession(data: { token: string; displayName: string; partyRole: string }): GovernanceSession {
  const next: GovernanceSession = { token: data.token, displayName: data.displayName, partyRole: data.partyRole }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function GovernanceAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GovernanceSession | null>(rehydrate)

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await axios.post<
      { token: string; displayName: string; partyRole: string } | { mfaRequired: true; mfaToken: string }
    >('/api/auth/login', { username, password })
    if ('mfaRequired' in data) {
      throw new MfaRequiredError(data.mfaToken)
    }
    setSession(storeSession(data))
  }, [])

  const verifyMfaCode = useCallback(async (mfaToken: string, code: string) => {
    const { data } = await axios.post<{ token: string; displayName: string; partyRole: string }>(
      '/api/auth/mfa/verify-login',
      { mfaToken, code },
    )
    setSession(storeSession(data))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
  }, [])

  return (
    <GovernanceAuthContext.Provider value={{ session, login, verifyMfaCode, logout }}>
      {children}
    </GovernanceAuthContext.Provider>
  )
}

export function useGovernanceAuth(): GovernanceAuthValue {
  const ctx = useContext(GovernanceAuthContext)
  if (!ctx) throw new Error('useGovernanceAuth must be used inside <GovernanceAuthProvider>')
  return ctx
}
