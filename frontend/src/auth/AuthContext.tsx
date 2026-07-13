import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

// react-refresh/only-export-components fires because this file exports the
// useAuth() hook (and a couple of role-lookup consts) alongside the
// AuthProvider component — a deliberate, standard context+hook pairing, not
// an oversight. Splitting the hook into its own file would ripple across
// every page that imports useAuth; the actual cost of leaving them together
// is losing component state on hot-reload edits to this file, not a runtime
// bug, so it's disabled here rather than restructured.
/* eslint-disable react-refresh/only-export-components */

/**
 * Portal authentication — now backed by the REAL backend session API
 * (review gap G1, docs/platform-review-2026-07.md). The previous version of
 * this context was an explicit mock: hardcoded credentials shipped in the
 * bundle, role stored in localStorage, gating *rendering only* while every
 * backend route stayed open. The backend now requires a session on the whole
 * /api surface (see backend/src/index.ts), so this context performs a real
 * login (POST /api/auth/login — bcrypt users table, Layer 3 of the
 * Policy-Approval Security Roadmap), stores the issued JWT for
 * client.ts's axios interceptor, and supports the TOTP MFA step (Layer 4)
 * for accounts that have it enabled.
 *
 * Demo accounts are seeded by `npm run seed:users` in backend/ — the
 * credentials shown on the login page exist in the database, not in this
 * bundle.
 */

export type UserRole = 'business' | 'financer' | 'vetify' | 'riskCommittee'

export interface User {
  name: string
  email: string
  role: UserRole
  orgName: string
}

interface AuthContextValue {
  user: User | null
  /** Resolves to 'mfa' when the account requires a TOTP code (call verifyMfa next). */
  login: (email: string, password: string) => Promise<'ok' | 'mfa'>
  verifyMfa: (code: string) => Promise<void>
  /** Self-serve account creation — auto-logs in and redirects straight to the
   * role's first onboarding form (see SIGNUP_REDIRECT), not the dashboard. */
  signup: (payload: { username: string; password: string; displayName: string; role: 'business' | 'financer' }) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const USER_KEY = 'vetify_user'
export const TOKEN_KEY = 'vetify_token'

const VALID_ROLES: ReadonlySet<string> = new Set(['business', 'financer', 'vetify', 'riskCommittee'])

// Display-only org labels per role (not identity — that comes from the backend).
const ROLE_ORG: Record<UserRole, string> = {
  business: 'Business Portal',
  financer: 'Financial Institution',
  vetify: 'Vetify Platform',
  riskCommittee: 'Risk & Credit Governance Committee',
}

export const ROLE_DASHBOARD: Record<UserRole, string> = {
  business: '/business/dashboard',
  financer: '/fi/dashboard',
  vetify: '/vetify/dashboard',
  riskCommittee: '/risk-committee/dashboard',
}

// Where a brand-new signup lands — straight into the first onboarding form
// rather than an empty dashboard, per the requested flow (signup → onboarding).
const SIGNUP_REDIRECT: Record<'business' | 'financer', string> = {
  business: '/business/onboarding',
  financer: '/fi/provider-settings',
}

const AuthContext = createContext<AuthContextValue | null>(null)

function rehydrateUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw || !localStorage.getItem(TOKEN_KEY)) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(rehydrateUser)
  const [pendingMfa, setPendingMfa] = useState<{ mfaToken: string; email: string } | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(TOKEN_KEY)
    }
  }, [user])

  const completeLogin = useCallback((token: string, displayName: string, partyRole: string, email: string, redirectTo?: string) => {
    if (!VALID_ROLES.has(partyRole)) {
      throw new Error(`This account's role ("${partyRole}") has no portal in this app`)
    }
    const role = partyRole as UserRole
    localStorage.setItem(TOKEN_KEY, token)
    setUser({ name: displayName, email, role, orgName: ROLE_ORG[role] })
    setPendingMfa(null)
    navigate(redirectTo ?? ROLE_DASHBOARD[role], { replace: true })
  }, [navigate])

  const login = useCallback(async (email: string, password: string): Promise<'ok' | 'mfa'> => {
    const username = email.toLowerCase().trim()
    try {
      const { data } = await axios.post<
        { mfaRequired: true; mfaToken: string } | { token: string; displayName: string; partyRole: string }
      >('/api/auth/login', { username, password })
      if ('mfaRequired' in data) {
        setPendingMfa({ mfaToken: data.mfaToken, email: username })
        return 'mfa'
      }
      completeLogin(data.token, data.displayName, data.partyRole, username)
      return 'ok'
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        throw new Error((err.response.data as { error?: string }).error ?? 'Invalid email or password')
      }
      throw new Error('Could not reach the Vetify API — is the backend running?')
    }
  }, [completeLogin])

  const signup = useCallback(async (payload: { username: string; password: string; displayName: string; role: 'business' | 'financer' }): Promise<void> => {
    const username = payload.username.toLowerCase().trim()
    try {
      const { data } = await axios.post<{ token: string; displayName: string; partyRole: string }>(
        '/api/auth/signup',
        { ...payload, username },
      )
      completeLogin(data.token, data.displayName, data.partyRole, username, SIGNUP_REDIRECT[payload.role])
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        throw new Error((err.response.data as { error?: string }).error ?? 'Signup failed')
      }
      throw new Error('Could not reach the Vetify API — is the backend running?')
    }
  }, [completeLogin])

  const verifyMfa = useCallback(async (code: string): Promise<void> => {
    if (!pendingMfa) throw new Error('No MFA challenge in progress — sign in first')
    try {
      const { data } = await axios.post<{ token: string; displayName: string; partyRole: string }>(
        '/api/auth/mfa/verify-login',
        { mfaToken: pendingMfa.mfaToken, code },
      )
      completeLogin(data.token, data.displayName, data.partyRole, pendingMfa.email)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        throw new Error((err.response.data as { error?: string }).error ?? 'Invalid or expired code')
      }
      throw new Error('Could not reach the Vetify API')
    }
  }, [pendingMfa, completeLogin])

  const logout = useCallback(() => {
    setUser(null)
    setPendingMfa(null)
    navigate('/', { replace: true })
  }, [navigate])

  return (
    <AuthContext.Provider value={{ user, login, verifyMfa, signup, logout, isAuthenticated: user !== null }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
