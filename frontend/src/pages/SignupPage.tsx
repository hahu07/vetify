import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

type SignupRole = 'business' | 'financer'

const ROLE_COPY: Record<SignupRole, { label: string; heading: string; body: string }> = {
  business: {
    label: 'Business',
    heading: 'Apply for financing',
    body: "Create your account, then complete your business's onboarding application — CAC registration, KYC documents, and director details.",
  },
  financer: {
    label: 'Financer',
    heading: 'Partner as a financer',
    body: 'Create your account, then register your institution as a financing provider for Vetify review.',
  },
}

export default function SignupPage() {
  const { signup } = useAuth()
  const [searchParams] = useSearchParams()
  const initialRole = searchParams.get('role') === 'financer' ? 'financer' : 'business'

  const [role, setRole] = useState<SignupRole>(initialRole)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copy = ROLE_COPY[role]

  const canSubmit = displayName.trim().length >= 2 && !!email && password.length >= 8 && password === confirmPassword

  const handleSubmit = async () => {
    if (loading || !canSubmit) return
    setError(null)
    setLoading(true)
    try {
      await signup({ username: email, password, displayName, role })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create your account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{
          backgroundColor: '#0A4A34',
          backgroundImage: `
            repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%),
            repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%)
          `,
          backgroundSize: '20px 20px',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#C9A84C' }}
          >
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Vetify</span>
        </div>

        <div>
          <div
            className="h-0.5 w-16 mb-8 rounded-full"
            style={{ background: 'linear-gradient(90deg, #C9A84C, #e8c97a)' }}
          />
          <h2 className="text-white text-2xl font-bold leading-tight mb-4" style={{ letterSpacing: '-0.01em' }}>
            {copy.heading}
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-10 max-w-xs">{copy.body}</p>
        </div>

        <p className="text-white/30 text-xs">
          CBN Non-Interest Finance · AAOIFI Standard No. 8, 28, 40
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors mb-8"
          >
            <ArrowLeft size={13} />
            Back to home
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-1" style={{ letterSpacing: '-0.01em' }}>
            Create your account
          </h1>
          <p className="text-sm text-gray-500 mb-6">Get started with Vetify in a few minutes</p>

          {/* Role toggle */}
          <div className="grid grid-cols-2 gap-2 mb-6" role="radiogroup" aria-label="Account type">
            {(Object.keys(ROLE_COPY) as SignupRole[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setRole(r)}
                disabled={loading}
                className="py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors"
                style={
                  role === r
                    ? { backgroundColor: '#0D6E4D', borderColor: '#0D6E4D', color: 'white' }
                    : { backgroundColor: 'white', borderColor: '#E5E7EB', color: '#374151' }
                }
              >
                {ROLE_COPY[r].label}
              </button>
            ))}
          </div>

          <form
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="displayName" className="block text-xs font-medium text-gray-700 mb-1.5">
                {role === 'business' ? 'Your name' : 'Contact name'}
              </label>
              <input
                id="displayName"
                type="text"
                autoComplete="name"
                placeholder="Full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="input"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1.5">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input"
                disabled={loading}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-1 text-xs text-red-600">Passwords don't match</p>
              )}
            </div>

            {error && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                role="alert"
              >
                <span className="text-xs">{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: '#0D6E4D' }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-gray-600 hover:text-gray-800 underline transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
