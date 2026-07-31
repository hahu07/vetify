"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText, Shield, Menu, X, ChevronRight, LogOut, Users, TrendingUp, ClipboardCheck, Landmark,
  Package, ShieldCheck, AlertTriangle, BookOpen, KeyRound, FileBarChart, Lock, Gavel, Building2, ScrollText, FileCheck,
  History,
} from "lucide-react";
import { useAuth, ROLE_DASHBOARD, type UserRole } from "@/lib/auth/AuthContext";

// Adapted from frontend/src/components/Layout.tsx: NavLink (react-router) ->
// Link + usePathname (Next.js), useAuth -> this slice's own AuthContext,
// NotificationBell dropped (no notifications table/route in this slice), nav
// items trimmed to the pages this migration has actually built so far
// (Stage 1-4, Stage 5-7 Financing UI, Stage 8-10 Murabahah UI, Governance
// registries UI, and this pass's Reporting UI).

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const roleNav: Record<UserRole, NavItem[]> = {
  business: [
    { label: "Onboarding", path: "/business/onboarding", icon: <FileText size={16} /> },
    { label: "Financing Request", path: "/business/financing", icon: <TrendingUp size={16} /> },
    { label: "Asset Acquisition", path: "/business/acquisition", icon: <Package size={16} /> },
    { label: "My Contracts", path: "/business/contracts", icon: <BookOpen size={16} /> },
  ],
  vetify: [
    { label: "Onboarding Pipeline", path: "/vetify/onboarding", icon: <Users size={16} /> },
    { label: "Compliance Reviews", path: "/vetify/compliance", icon: <Shield size={16} /> },
    { label: "Underwriting Queue", path: "/vetify/underwriting", icon: <ClipboardCheck size={16} /> },
    { label: "Shariah Certification", path: "/vetify/shariah-certification", icon: <ShieldCheck size={16} /> },
    { label: "Document Verification", path: "/vetify/documents", icon: <FileCheck size={16} /> },
    { label: "Delinquency Monitoring", path: "/vetify/delinquency", icon: <AlertTriangle size={16} /> },
    { label: "Collateral Oversight", path: "/vetify/collateral", icon: <Lock size={16} /> },
    { label: "Dispute Resolution", path: "/vetify/disputes", icon: <Gavel size={16} /> },
    { label: "Registries", path: "/vetify/registries", icon: <KeyRound size={16} /> },
    { label: "Provider Registrations", path: "/vetify/providers", icon: <Building2 size={16} /> },
    { label: "Policy Governance", path: "/vetify/policies", icon: <ScrollText size={16} /> },
    { label: "Portfolio Reports", path: "/vetify/reports", icon: <FileBarChart size={16} /> },
    { label: "Compliance Oversight", path: "/vetify/oversight", icon: <History size={16} /> },
    { label: "Regulatory Inspections", path: "/vetify/inspections", icon: <ClipboardCheck size={16} /> },
  ],
  financialInstitution: [
    { label: "Financing Decisions", path: "/fi/financing", icon: <Landmark size={16} /> },
    { label: "Provider Registration", path: "/fi/provider-registration", icon: <Building2 size={16} /> },
    { label: "Asset Acquisition", path: "/fi/acquisition", icon: <Package size={16} /> },
    { label: "Contracts", path: "/fi/contracts", icon: <BookOpen size={16} /> },
    { label: "Officer Registry", path: "/fi/officers", icon: <KeyRound size={16} /> },
    { label: "Portfolio Reports", path: "/fi/reports", icon: <FileBarChart size={16} /> },
    { label: "Regulatory Inspections", path: "/fi/inspections", icon: <ClipboardCheck size={16} /> },
  ],
  regulator: [{ label: "Portfolio Reports", path: "/regulator/reports", icon: <FileBarChart size={16} /> }],
  riskCommittee: [{ label: "Policy Endorsement Queue", path: "/riskcommittee/policies", icon: <ScrollText size={16} /> }],
};

const ROLE_BADGE: Record<UserRole, { label: string; bg: string; text: string }> = {
  business: { label: "SME Business", bg: "rgba(13,110,77,0.18)", text: "#6EE7B7" },
  vetify: { label: "Vetify Staff", bg: "rgba(201,168,76,0.20)", text: "#e8c97a" },
  financialInstitution: { label: "Financial Institution", bg: "rgba(59,130,246,0.20)", text: "#93c5fd" },
  regulator: { label: "Regulator", bg: "rgba(139,92,246,0.20)", text: "#c4b5fd" },
  riskCommittee: { label: "Risk Committee", bg: "rgba(220,38,38,0.18)", text: "#fca5a5" },
};

interface Props {
  children: React.ReactNode;
  title?: string;
  breadcrumb?: { label: string; path?: string }[];
}

export default function Layout({ children, title, breadcrumb }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const role: UserRole = user?.role ?? "business";
  const navItems = roleNav[role];
  const roleBadge = ROLE_BADGE[role];
  const dashboardPath = ROLE_DASHBOARD[role];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#C9A84C" }}>
            <span className="text-white font-bold text-base">V</span>
          </div>
          <div>
            <div className="text-white font-semibold text-sm tracking-tight">Vetify</div>
            <div className="text-white/50 text-xs">Platform</div>
          </div>
        </div>
        <div className="mt-1 pl-0.5">
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: roleBadge.bg, color: roleBadge.text }}
          >
            {roleBadge.label}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="text-white/40 text-xs uppercase tracking-widest px-2 mb-2">Navigation</div>
        {navItems.map((item) => {
          const isActive = item.path === dashboardPath ? pathname === item.path : pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive ? "bg-white/15 text-white shadow-sm" : "text-white/65 hover:text-white hover:bg-white/8"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 pt-3 border-t border-white/10">
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
              style={{ backgroundColor: "#C9A84C", color: "#fff" }}
            >
              {user?.name?.[0] ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user?.name ?? "—"}</div>
              <div className="text-white/40 text-xs truncate">{user?.orgName ?? "—"}</div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors group"
          >
            <LogOut size={13} className="flex-shrink-0" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <aside className="hidden lg:flex w-60 flex-col flex-shrink-0 sidebar-pattern">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-60 sidebar-pattern z-50">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 p-1 rounded text-white/60 hover:text-white">
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center gap-4 px-6 h-14 bg-white border-b border-gray-200 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            {breadcrumb ? (
              <nav className="flex items-center gap-1.5 text-sm">
                {breadcrumb.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight size={14} className="text-gray-400" />}
                    {crumb.path && i < breadcrumb.length - 1 ? (
                      <Link href={crumb.path} className="text-gray-500 hover:text-gray-700 transition-colors">
                        {crumb.label}
                      </Link>
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

          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: "#0D6E4D" }}
            >
              {user?.name?.[0] ?? "?"}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
