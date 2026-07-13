import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { login, verifyMfa } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Layer 4: set after a successful password step on an MFA-enabled account —
  // the form switches to a 6-digit TOTP code input until verifyMfa succeeds.
  const [mfaStep, setMfaStep] = useState(false)
  const [mfaCode, setMfaCode] = useState('')

  const handleSubmit = async () => {
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      if (mfaStep) {
        if (!mfaCode) return
        await verifyMfa(mfaCode)
      } else {
        if (!email || !password) return
        const result = await login(email, password)
        if (result === 'mfa') setMfaStep(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password')
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
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#C9A84C' }}
          >
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Vetify</span>
        </div>

        {/* Center content */}
        <div>
          {/* Gold accent bar */}
          <div
            className="h-0.5 w-16 mb-8 rounded-full"
            style={{ background: 'linear-gradient(90deg, #C9A84C, #e8c97a)' }}
          />
          <h2 className="text-white text-2xl font-bold leading-tight mb-4" style={{ letterSpacing: '-0.01em' }}>
            Financing the Future<br />of Nigerian Business
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-10 max-w-xs">
            AI-powered Murabahah financing — Shariah-certified, fully digital, built on the Canton blockchain.
          </p>

          {/* Testimonial */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <p className="text-white/80 text-sm leading-relaxed italic mb-4">
              "Vetify approved our financing in less than 24 hours. No paperwork, no interest,
              everything fully transparent. Exactly what our business needed."
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm"
                style={{ backgroundColor: '#C9A84C', color: '#0A4A34' }}
              >
                F
              </div>
              <div>
                <p className="text-white text-xs font-semibold">Fatima Abdullahi</p>
                <p className="text-white/50 text-xs">Fatima Tailoring Cooperative, Kano</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-white/30 text-xs">
          CBN Non-Interest Finance · AAOIFI Standard No. 8, 28, 40
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Back to home */}
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors mb-8"
          >
            <ArrowLeft size={13} />
            Back to home
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-1" style={{ letterSpacing: '-0.01em' }}>
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 mb-8">Sign in to your Vetify account</p>

          <form
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            className="space-y-4"
          >
            {!mfaStep && (
              <>
                {/* Email */}
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

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
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
              </>
            )}

            {/* Layer 4 TOTP step — shown only for MFA-enabled accounts */}
            {mfaStep && (
              <div>
                <label htmlFor="mfa-code" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Authenticator code
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className="input font-mono tracking-widest"
                  disabled={loading}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  This account has MFA enabled — enter the 6-digit code from your authenticator app.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                role="alert"
              >
                <span className="text-xs">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || (mfaStep ? mfaCode.length !== 6 : (!email || !password))}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: '#0D6E4D' }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {mfaStep ? 'Verifying…' : 'Signing in…'}
                </>
              ) : (
                mfaStep ? 'Verify code' : 'Sign in'
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div
            className="mt-6 rounded-xl p-4"
            style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
          >
            <p className="text-xs font-semibold text-gray-500 mb-2">Demo credentials</p>
            <table className="w-full text-xs text-gray-600">
              <tbody className="space-y-1">
                <tr>
                  <td className="py-0.5 font-medium text-gray-500 pr-3 w-16">Business</td>
                  <td className="py-0.5 font-mono text-gray-700">business@vetify.ng</td>
                </tr>
                <tr>
                  <td className="py-0.5 font-medium text-gray-500 pr-3">Financer</td>
                  <td className="py-0.5 font-mono text-gray-700">fi@vetify.ng</td>
                </tr>
                <tr>
                  <td className="py-0.5 font-medium text-gray-500 pr-3">Staff</td>
                  <td className="py-0.5 font-mono text-gray-700">admin@vetify.ng</td>
                </tr>
                <tr>
                  <td className="py-0.5 font-medium text-gray-500 pr-3">Risk Committee</td>
                  <td className="py-0.5 font-mono text-gray-700">risk@vetify.ng</td>
                </tr>
                <tr>
                  <td className="py-0.5 font-medium text-gray-500 pr-3">Password</td>
                  <td className="py-0.5 font-mono text-gray-700">password123</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-gray-600 hover:text-gray-800 underline transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
