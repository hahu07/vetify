import { Navigate } from 'react-router-dom'
import { useAuth, ROLE_DASHBOARD } from './AuthContext'
import type { UserRole } from './AuthContext'

interface Props {
  children: React.ReactNode
  role: UserRole
}

/**
 * Guards a route by role.
 * - Not authenticated → /login
 * - Wrong role → redirect to their correct dashboard
 * - Correct role → render children
 */
export default function ProtectedRoute({ children, role }: Props) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== role) {
    return <Navigate to={ROLE_DASHBOARD[user.role]} replace />
  }

  return <>{children}</>
}
