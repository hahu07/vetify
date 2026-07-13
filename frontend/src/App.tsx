import { Routes, Route, Navigate } from 'react-router-dom'

// Auth
import ProtectedRoute from './auth/ProtectedRoute'

// Public pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

// Business pages
import BusinessDashboard from './pages/business/BusinessDashboard'
import OnboardingForm from './pages/business/OnboardingForm'
import FinancingForm from './pages/business/FinancingForm'
import BusinessContractDetail from './pages/business/ContractDetail'
import AcquisitionStatus from './pages/business/AcquisitionStatus'

// FI pages
import FIDashboard from './pages/fi/FIDashboard'
import ContractList from './pages/fi/ContractList'
import ContractDetail from './pages/fi/ContractDetail'
import UnderwritingQueue from './pages/fi/UnderwritingQueue'
import ProviderSettings from './pages/fi/ProviderSettings'
import AcquisitionQueue from './pages/fi/AcquisitionQueue'

// Compliance pages (reused in Vetify portal)
import ComplianceDashboard from './pages/compliance/ComplianceDashboard'
import ComplianceReview from './pages/compliance/ComplianceReview'

// Vetify internal portal pages
import VetifyDashboard from './pages/vetify/VetifyDashboard'
import VetifyOnboarding from './pages/vetify/VetifyOnboarding'
import DelinquencyMonitoring from './pages/vetify/DelinquencyMonitoring'
import Registries from './pages/vetify/Registries'
import AssessorQueue from './pages/vetify/AssessorQueue'
import AgentActivity from './pages/vetify/AgentActivity'
import VetifyReports from './pages/vetify/VetifyReports'
import ProviderApprovals from './pages/vetify/ProviderApprovals'
import PolicyGovernance from './pages/vetify/PolicyGovernance'
import DevTools from './pages/vetify/DevTools'

// Risk Committee portal
import RiskCommitteeDashboard from './pages/risk-committee/RiskCommitteeDashboard'

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Business portal */}
      <Route
        path="/business/dashboard"
        element={
          <ProtectedRoute role="business">
            <BusinessDashboard />
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
      <Route
        path="/business/acquisition"
        element={
          <ProtectedRoute role="business">
            <AcquisitionStatus />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business/contracts/:id"
        element={
          <ProtectedRoute role="business">
            <BusinessContractDetail />
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
        path="/fi/acquisition"
        element={
          <ProtectedRoute role="financer">
            <AcquisitionQueue />
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
        path="/vetify/monitoring"
        element={
          <ProtectedRoute role="vetify">
            <DelinquencyMonitoring />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vetify/registries"
        element={
          <ProtectedRoute role="vetify">
            <Registries />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vetify/underwriting"
        element={
          <ProtectedRoute role="vetify">
            <AssessorQueue />
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

      {/* Dev Tools (Stage 2/3 simulation) — dev build only; the backend route
          it calls is separately hard-gated on NODE_ENV, this just keeps the
          page itself out of a production bundle's routing table too. */}
      {import.meta.env.DEV && (
        <Route
          path="/vetify/dev-tools"
          element={
            <ProtectedRoute role="vetify">
              <DevTools />
            </ProtectedRoute>
          }
        />
      )}

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
