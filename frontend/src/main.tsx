import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import { GovernanceAuthProvider } from './auth/GovernanceAuthContext'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Every page polls the ledger every 10s — this is a live multi-party
      // workflow (staff, business, FI, advisor all acting on the same
      // contracts from different sessions), so a page left open needs to
      // pick up another party's action without a manual reload.
      refetchInterval: 10_000,
      refetchIntervalInBackground: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <GovernanceAuthProvider>
            <App />
          </GovernanceAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
