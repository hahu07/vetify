import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  TrendingUp,
  Shield,
  ShieldCheck,
  BarChart3,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Bot,
  Users,
  Building2,
  FlaskConical,
  AlertTriangle,
  Truck,
} from 'lucide-react'
import { useAuth, ROLE_DASHBOARD } from '../auth/AuthContext'
import type { UserRole } from '../auth/AuthContext'
import NotificationBell from './NotificationBell'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

const roleNav: Record<UserRole, NavItem[]> = {
  business: [
    { label: 'Dashboard', path: '/business/dashboard', icon: <LayoutDashboard size={16} /> },
    { label: 'Apply for Financing', path: '/business/financing', icon: <TrendingUp size={16} /> },
    { label: 'Acquisition Status', path: '/business/acquisition', icon: <Truck size={16} /> },
    { label: 'Onboarding', path: '/business/onboarding', icon: <FileText size={16} /> },
  ],
  financer: [
    { label: 'Portfolio', path: '/fi/dashboard', icon: <BarChart3 size={16} /> },
    { label: 'Contracts', path: '/fi/contracts', icon: <FileText size={16} /> },
    { label: 'Acquisition Pipeline', path: '/fi/acquisition', icon: <Truck size={16} /> },
    { label: 'Underwriting', path: '/fi/underwriting', icon: <ClipboardCheck size={16} /> },
    { label: 'Provider Settings', path: '/fi/provider-settings', icon: <Building2 size={16} /> },
  ],
  vetify: [
    { label: 'Overview', path: '/vetify/dashboard', icon: <LayoutDashboard size={16} /> },
    { label: 'Onboarding Pipeline', path: '/vetify/onboarding', icon: <Users size={16} /> },
    { label: 'Compliance Reviews', path: '/vetify/compliance', icon: <Shield size={16} /> },
    { label: 'Underwriting Queue', path: '/vetify/underwriting', icon: <ClipboardCheck size={16} /> },
    { label: 'Provider Approvals', path: '/vetify/providers', icon: <Building2 size={16} /> },
    { label: 'Delinquency Monitoring', path: '/vetify/monitoring', icon: <AlertTriangle size={16} /> },
    { label: 'Policy Governance', path: '/vetify/policy', icon: <ShieldCheck size={16} /> },
    { label: 'Authorization Registries', path: '/vetify/registries', icon: <Users size={16} /> },
    { label: 'AI Agent Activity', path: '/vetify/agents', icon: <Bot size={16} /> },
    { label: 'Reports', path: '/vetify/reports', icon: <BarChart3 size={16} /> },
  ],
  riskCommittee: [
    { label: 'Pending Endorsements', path: '/risk-committee/dashboard', icon: <ShieldCheck size={16} /> },
  ],
}

const ROLE_BADGE: Record<UserRole, { label: string; bg: string; text: string }> = {
  business: { label: 'SME Business', bg: 'rgba(13,110,77,0.18)', text: '#6EE7B7' },
  financer: { label: 'Financial Institution', bg: 'rgba(59,130,246,0.18)', text: '#93C5FD' },
  vetify: { label: 'Vetify Staff', bg: 'rgba(201,168,76,0.20)', text: '#e8c97a' },
  riskCommittee: { label: 'Risk & Credit Governance Committee', bg: 'rgba(168,85,247,0.18)', text: '#D8B4FE' },
}

interface Props {
  children: React.ReactNode
  title?: string
  breadcrumb?: { label: string; path?: string }[]
}

export default function Layout({ children, title, breadcrumb }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()

  const role: UserRole = user?.role ?? 'business'
  // Dev Tools (Stage 2/3 simulation, routes/dev.ts) — only ever rendered in
  // a Vite dev build (import.meta.env.DEV is false in a production build);
  // the backend route itself is separately hard-gated on NODE_ENV, so this
  // is a UI convenience on top of a real server-side gate, not the only one.
  const navItems = role === 'vetify' && import.meta.env.DEV
    ? [...roleNav[role], { label: 'Dev Tools', path: '/vetify/dev-tools', icon: <FlaskConical size={16} /> }]
    : roleNav[role]
  const roleBadge = ROLE_BADGE[role]

  // Dashboard root path per role (for "end" matching)
  const dashboardPath = ROLE_DASHBOARD[role]

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo + role badge */}
      <div className="flex flex-col gap-2 px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#C9A84C' }}
          >
            <span className="text-white font-bold text-base">V</span>
          </div>
          <div>
            <div className="text-white font-semibold text-sm tracking-tight">Vetify</div>
            <div className="text-white/50 text-xs">Platform</div>
          </div>
        </div>
        {/* Role badge */}
        <div className="mt-1 pl-0.5">
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: roleBadge.bg, color: roleBadge.text }}
          >
            {roleBadge.label}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="text-white/40 text-xs uppercase tracking-widest px-2 mb-2">Navigation</div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === dashboardPath}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/65 hover:text-white hover:bg-white/8'
              }`
            }
            onClick={() => setSidebarOpen(false)}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-3 pb-4 pt-3 border-t border-white/10">
        <div className="px-3 py-2.5">
          {/* User name + org */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
              style={{ backgroundColor: '#C9A84C', color: '#fff' }}
            >
              {user?.name?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user?.name ?? '—'}</div>
              <div className="text-white/40 text-xs truncate">{user?.orgName ?? '—'}</div>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors group"
          >
            <LogOut size={13} className="flex-shrink-0" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-60 flex-col flex-shrink-0 sidebar-pattern">
        <SidebarContent />
      </aside>

      {/* Sidebar — mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex flex-col w-60 sidebar-pattern z-50">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1 rounded text-white/60 hover:text-white"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header */}
        <header className="flex items-center gap-4 px-6 h-14 bg-white border-b border-gray-200 flex-shrink-0">
          {/* Hamburger - mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb / Title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {breadcrumb ? (
              <nav className="flex items-center gap-1.5 text-sm">
                {breadcrumb.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight size={14} className="text-gray-400" />}
                    {crumb.path && i < breadcrumb.length - 1 ? (
                      <NavLink to={crumb.path} className="text-gray-500 hover:text-gray-700 transition-colors">
                        {crumb.label}
                      </NavLink>
                    ) : (
                      <span className="text-gray-900 font-medium truncate">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            ) : (
              <h1 className="text-sm font-semibold text-gray-900 truncate">{title}</h1>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: '#0D6E4D' }}
            >
              {user?.name?.[0] ?? '?'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
