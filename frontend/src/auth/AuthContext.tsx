import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export type UserRole = 'business' | 'financer' | 'vetify' | 'riskCommittee'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  orgName: string
}

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const STORAGE_KEY = 'vetify_user'

const MOCK_USERS: Record<string, User & { password: string }> = {
  'business@vetify.ng': {
    id: 'usr-001',
    name: 'Adekunle Bello',
    email: 'business@vetify.ng',
    role: 'business',
    orgName: 'Adekunle Foods & Beverages Ltd',
    password: 'password123',
  },
  'fi@vetify.ng': {
    id: 'usr-002',
    name: 'Fatima Musa',
    email: 'fi@vetify.ng',
    role: 'financer',
    orgName: 'First Trust Finance Ltd',
    password: 'password123',
  },
  'admin@vetify.ng': {
    id: 'usr-003',
    name: 'Yusuf Ibrahim',
    email: 'admin@vetify.ng',
    role: 'vetify',
    orgName: 'Vetify Platform',
    password: 'password123',
  },
  // Layer 2 of the Policy-Approval Security Roadmap: a genuinely distinct
  // portal/login from the vetify staff portal above — not just a different
  // nav section under the same account — since the whole point is that this
  // party's credentials must be held separately from whoever operates vetify.
  'risk@vetify.ng': {
    id: 'usr-004',
    name: 'Imam Yusuf Abdullahi',
    email: 'risk@vetify.ng',
    role: 'riskCommittee',
    orgName: 'Risk & Credit Governance Committee',
    password: 'password123',
  },
}

export const ROLE_DASHBOARD: Record<UserRole, string> = {
  business: '/business/dashboard',
  financer: '/fi/dashboard',
  vetify: '/vetify/dashboard',
  riskCommittee: '/risk-committee/dashboard',
}

const AuthContext = createContext<AuthContextValue | null>(null)

function rehydrateUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(rehydrateUser)
  const navigate = useNavigate()

  // Keep localStorage in sync whenever user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    const match = MOCK_USERS[email.toLowerCase().trim()]
    if (!match || match.password !== password) {
      throw new Error('Invalid email or password')
    }

    const { password: _pw, ...userWithoutPassword } = match
    setUser(userWithoutPassword)
    navigate(ROLE_DASHBOARD[userWithoutPassword.role], { replace: true })
  }, [navigate])

  const logout = useCallback(() => {
    setUser(null)
    navigate('/', { replace: true })
  }, [navigate])

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: user !== null }}>
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
