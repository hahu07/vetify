import { useState } from 'react'
import { LogIn, ShieldCheck, KeyRound } from 'lucide-react'
import { useGovernanceAuth, MfaRequiredError } from '../auth/GovernanceAuthContext'
import { useMfaEnrollInit, useMfaEnrollVerify, useMfaDisable } from '../api/client'

/**
 * Layer 3 gate: shown in place of the free-text "your name" boxes that used
 * to accompany Endorse/Approve/Reject actions. Requires a real login against
 * the backend's own user table (backend/src/appdb.ts) before those actions
 * are enabled — see GovernanceAuthContext.tsx's doc comment.
 *
 * Layer 4: also offers TOTP MFA enrollment once signed in, and prompts for a
 * 6-digit code mid-login when the account already has it enabled.
 */
export default function GovernanceSignIn({ requiredRole }: { requiredRole?: string }) {
  const { session, login, verifyMfaCode, logout } = useGovernanceAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingMfaToken, setPendingMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')

  const [showMfaSetup, setShowMfaSetup] = useState(false)
  const [enrollment, setEnrollment] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null)
  const [enrollCode, setEnrollCode] = useState('')
  const [mfaMessage, setMfaMessage] = useState<string | null>(null)
  const enrollInit = useMfaEnrollInit()
  const enrollVerify = useMfaEnrollVerify()
  const disableMfa = useMfaDisable()

  if (session) {
    const wrongRole = requiredRole && session.partyRole !== requiredRole
    return (
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className={wrongRole ? 'text-amber-600' : 'text-emerald-600'} />
            <span className="text-xs text-gray-700">
              Signed in as <strong>{session.displayName}</strong> ({session.partyRole})
            </span>
            {wrongRole && (
              <span className="text-xs text-amber-600">— this action needs a {requiredRole} session</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowMfaSetup((v) => !v)} className="text-xs text-primary hover:underline flex items-center gap-1">
              <KeyRound size={12} />
              Manage MFA
            </button>
            <button onClick={logout} className="text-xs text-gray-500 hover:underline">Sign out</button>
          </div>
        </div>

        {showMfaSetup && (
          <div className="pt-2 border-t border-gray-200 space-y-2">
            {!enrollment ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setMfaMessage(null)
                    const result = await enrollInit.mutateAsync(session.token)
                    setEnrollment({ qrCodeDataUrl: result.qrCodeDataUrl, secret: result.secret })
                  }}
                  disabled={enrollInit.isPending}
                  className="btn-secondary text-xs disabled:opacity-50"
                >
                  {enrollInit.isPending ? 'Generating…' : 'Enable TOTP MFA'}
                </button>
                <button
                  onClick={async () => {
                    setMfaMessage(null)
                    await disableMfa.mutateAsync(session.token)
                    setMfaMessage('MFA disabled for this account')
                  }}
                  disabled={disableMfa.isPending}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Disable MFA
                </button>
                {mfaMessage && <span className="text-xs text-gray-500">{mfaMessage}</span>}
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <img src={enrollment.qrCodeDataUrl} alt="TOTP QR code" className="w-28 h-28 border border-gray-200 rounded" />
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">
                    Scan with an authenticator app (or enter manually: <code className="font-mono">{enrollment.secret}</code>),
                    then confirm with the current code.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      className="input text-sm w-28"
                      placeholder="123456"
                      value={enrollCode}
                      onChange={(e) => setEnrollCode(e.target.value)}
                    />
                    <button
                      onClick={async () => {
                        setMfaMessage(null)
                        try {
                          await enrollVerify.mutateAsync({ token: session.token, code: enrollCode })
                          setMfaMessage('MFA enabled — future logins will require a code')
                          setEnrollment(null)
                          setEnrollCode('')
                        } catch {
                          setMfaMessage('Invalid code — try again')
                        }
                      }}
                      disabled={enrollCode.length < 6 || enrollVerify.isPending}
                      className="btn-primary text-xs disabled:opacity-40"
                    >
                      Confirm
                    </button>
                  </div>
                  {mfaMessage && <p className="text-xs text-gray-500">{mfaMessage}</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (pendingMfaToken) {
    const onVerify = async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setLoading(true)
      try {
        await verifyMfaCode(pendingMfaToken, mfaCode)
        setPendingMfaToken(null)
        setMfaCode('')
      } catch {
        setError('Invalid or expired code')
      } finally {
        setLoading(false)
      }
    }
    return (
      <form onSubmit={onVerify} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100 mb-4">
        <KeyRound size={14} className="text-primary flex-shrink-0" />
        <span className="text-xs text-gray-600 flex-shrink-0">Enter your 6-digit MFA code</span>
        <input className="input text-sm w-28" placeholder="123456" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
        {error && <p className="text-xs text-red-600 flex-shrink-0">{error}</p>}
        <button type="submit" disabled={mfaCode.length < 6 || loading} className="btn-primary text-sm disabled:opacity-40 flex-shrink-0">
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      if (err instanceof MfaRequiredError) {
        setPendingMfaToken(err.mfaToken)
      } else {
        setError('Invalid username or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100 mb-4">
      <input className="input text-sm flex-1" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input className="input text-sm flex-1" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-xs text-red-600 flex-shrink-0">{error}</p>}
      <button type="submit" disabled={loading} className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-50 flex-shrink-0">
        <LogIn size={14} />
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
