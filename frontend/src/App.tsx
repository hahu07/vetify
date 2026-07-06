import { Routes, Route, Navigate } from 'react-router-dom'

// Auth
import ProtectedRoute from './auth/ProtectedRoute'

// Public pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'

// Business (borrower) pages
import BorrowerDashboard from './pages/borrower/BorrowerDashboard'
import OnboardingForm from './pages/borrower/OnboardingForm'
import FinancingForm from './pages/borrower/FinancingForm'

// FI pages
import FIDashboard from './pages/fi/FIDashboard'
import ContractList from './pages/fi/ContractList'
import ContractDetail from './pages/fi/ContractDetail'
import UnderwritingQueue from './pages/fi/UnderwritingQueue'
import ProviderSettings from './pages/fi/ProviderSettings'

// Compliance pages (reused in Vetify portal)
import ComplianceDashboard from './pages/compliance/ComplianceDashboard'
import ComplianceReview from './pages/compliance/ComplianceReview'

// Vetify internal portal pages
import VetifyDashboard from './pages/vetify/VetifyDashboard'
import VetifyOnboarding from './pages/vetify/VetifyOnboarding'
import AgentActivity from './pages/vetify/AgentActivity'
import VetifyReports from './pages/vetify/VetifyReports'
import ProviderApprovals from './pages/vetify/ProviderApprovals'
import PolicyGovernance from './pages/vetify/PolicyGovernance'

// Risk Committee portal
import RiskCommitteeDashboard from './pages/risk-committee/RiskCommitteeDashboard'

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Business (borrower) portal */}
      <Route
        path="/business/dashboard"
        element={
          <ProtectedRoute role="business">
            <BorrowerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business/onboarding"
        element={
          <ProtectedRoute role="business">
            <OnboardingForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business/financing"
        element={
          <ProtectedRoute role="business">
            <FinancingForm />
          </ProtectedRoute>
        }
      />

      {/* Financial institution portal */}
      <Route
        path="/fi/dashboard"
        element={
          <ProtectedRoute role="financer">
            <FIDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fi/contracts"
        element={
          <ProtectedRoute role="financer">
            <ContractList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fi/contracts/:id"
        element={
          <ProtectedRoute role="financer">
            <ContractDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fi/underwriting"
        element={
          <ProtectedRoute role="financer">
            <UnderwritingQueue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fi/provider-settings"
        element={
          <ProtectedRoute role="financer">
            <ProviderSettings />
          </ProtectedRoute>
        }
      />

      {/* Vetify internal portal */}
      <Route
        path="/vetify/dashboard"
        element={
          <ProtectedRoute role="vetify">
            <VetifyDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vetify/onboarding"
        element={
          <ProtectedRoute role="vetify">
            <VetifyOnboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vetify/compliance"
        element={
          <ProtectedRoute role="vetify">
            <ComplianceDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vetify/compliance/:id"
        element={
          <ProtectedRoute role="vetify">
            <ComplianceReview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vetify/agents"
        element={
          <ProtectedRoute role="vetify">
            <AgentActivity />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vetify/reports"
        element={
          <ProtectedRoute role="vetify">
            <VetifyReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vetify/providers"
        element={
          <ProtectedRoute role="vetify">
            <ProviderApprovals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vetify/policy"
        element={
          <ProtectedRoute role="vetify">
            <PolicyGovernance />
          </ProtectedRoute>
        }
      />

      {/* Risk Committee portal */}
      <Route
        path="/risk-committee/dashboard"
        element={
          <ProtectedRoute role="riskCommittee">
            <RiskCommitteeDashboard />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
