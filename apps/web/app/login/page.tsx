"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";

// Adapted from frontend/src/pages/LoginPage.tsx: email -> username (this
// slice's users table has no email column), MFA step and signup link
// dropped (not in Phase 1 scope), demo credentials hint updated to the
// three seeded accounts (npm run seed).

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (loading || !username || !password) return;
    setError(null);
    setLoading(true);
    try {
      const { data } = await axios.post("/api/auth/login", { username, password });
      queryClient.clear();
      if (data.partyRole === "business") {
        router.push("/business/onboarding");
      } else {
        router.push("/vetify/onboarding");
      }
      router.refresh();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError((err.response.data as { error?: string }).error ?? "Invalid username or password");
      } else {
        setError("Invalid username or password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 sidebar-pattern"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#C9A84C" }}>
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Vetify</span>
        </div>

        <div>
          <div className="h-0.5 w-16 mb-8 rounded-full" style={{ background: "linear-gradient(90deg, #C9A84C, #e8c97a)" }} />
          <h2 className="text-white text-2xl font-bold leading-tight mb-4" style={{ letterSpacing: "-0.01em" }}>
            Financing the Future
            <br />
            of Nigerian Business
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-10 max-w-xs">
            AI-powered Murabahah financing — Shariah-certified, fully digital. This page is the Phase 1
            Postgres/Next.js vertical-slice proof of concept (see docs/web2-migration-design.md).
          </p>
        </div>

        <p className="text-white/30 text-xs">CBN Non-Interest Finance · AAOIFI Standard No. 8, 28, 40</p>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors mb-8">
            <ArrowLeft size={13} />
            Back to home
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-1" style={{ letterSpacing: "-0.01em" }}>
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 mb-8">Sign in to your Vetify account</p>

          <form
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                id="username"
                autoComplete="username"
                placeholder="business1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                  type={showPassword ? "text" : "password"}
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
                role="alert"
              >
                <span className="text-xs">{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: "#0D6E4D" }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-6 rounded-xl p-4" style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB" }}>
            <p className="text-xs font-semibold text-gray-500 mb-2">Demo credentials (npm run seed)</p>
            <table className="w-full text-xs text-gray-600">
              <tbody>
                <tr>
                  <td className="py-0.5 font-medium text-gray-500 pr-3 w-20">Business</td>
                  <td className="py-0.5 font-mono text-gray-700">business1</td>
                </tr>
                <tr>
                  <td className="py-0.5 font-medium text-gray-500 pr-3">Verifier</td>
                  <td className="py-0.5 font-mono text-gray-700">verifier1</td>
                </tr>
                <tr>
                  <td className="py-0.5 font-medium text-gray-500 pr-3">Vetify Ops</td>
                  <td className="py-0.5 font-mono text-gray-700">vetify1</td>
                </tr>
                <tr>
                  <td className="py-0.5 font-medium text-gray-500 pr-3">Password</td>
                  <td className="py-0.5 font-mono text-gray-700">password123</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
