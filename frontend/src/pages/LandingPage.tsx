import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Link2,
  Bot,
  Building2,
  Menu,
  X,
  TrendingUp,
  FileCheck,
  Banknote,
} from 'lucide-react'

const TRUST_ITEMS = [
  { icon: Building2, label: 'CBN Non-Interest Finance Framework' },
  { icon: CheckCircle2, label: 'AAOIFI Shariah Standards (No. 8, 28, 40)' },
  { icon: Link2, label: 'Canton Blockchain — Immutable Audit Trail' },
  { icon: Bot, label: '5 AI Agents — Automated Underwriting' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: FileCheck,
    title: 'Apply & Verify',
    desc: 'Submit your business profile and KYC documents. Our AI Verification Agent validates your identity, CAC registration, and BVN/NIN in minutes.',
  },
  {
    step: '02',
    icon: TrendingUp,
    title: 'AI Underwriting',
    desc: 'Our Underwriting Agent analyses your cash flow via bank statement, calculates your DSCR, and recommends a financing limit — all in hours, not weeks.',
  },
  {
    step: '03',
    icon: Banknote,
    title: 'Murabahah Contract',
    desc: 'Your financer purchases the asset and sells it to you at a disclosed profit margin. Fixed installments, no hidden interest, fully transparent pricing.',
  },
]

const BUSINESS_BENEFITS = [
  'Shariah-compliant — no Riba (interest)',
  'Fast decision — typically under 48 hours',
  'Fully digital — no paper forms, no branch visits',
  'Transparent pricing — all costs disclosed upfront',
  'Certified under AAOIFI Standard No. 8',
]

const FINANCER_BENEFITS = [
  'AI-scored risk — DSCR + cash flow analysis',
  'Immutable audit trail on Canton blockchain',
  'CBN-compliant reporting built-in',
  'Real-time delinquency monitoring',
  'RegTech ready — one-click compliance reports',
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF9', fontFamily: 'Inter, sans-serif' }}>
      {/* ── Navigation ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-shadow duration-200"
        style={{
          backgroundColor: '#fff',
          boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.08)' : '0 1px 0 rgba(0,0,0,0.06)',
        }}
      >
        <div className="max-w-6xl mx-auto px-5 flex items-center h-16 gap-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 mr-auto lg:mr-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#0D6E4D' }}
            >
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-semibold text-gray-900 tracking-tight">Vetify</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-7 mx-auto">
            {['How It Works', 'For Businesses', 'For Financers'].map((label) => (
              <a
                key={label}
                href={`#${label.replace(/\s+/g, '-').toLowerCase()}`}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {label}
              </a>
            ))}
          </div>

          {/* Desktop CTA buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={{ borderColor: '#0D6E4D', color: '#0D6E4D' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0D6E4D'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#0D6E4D'
              }}
            >
              Login
            </Link>
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#0D6E4D' }}
            >
              Apply Now
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-5 py-4 space-y-3">
            {['How It Works', 'For Businesses', 'For Financers'].map((label) => (
              <a
                key={label}
                href={`#${label.replace(/\s+/g, '-').toLowerCase()}`}
                className="block text-sm text-gray-700 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/login"
                className="block text-center px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: '#0D6E4D', color: '#0D6E4D' }}
              >
                Login
              </Link>
              <Link
                to="/login"
                className="block text-center px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#0D6E4D' }}
              >
                Apply Now
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section
        className="pt-28 pb-20 px-5"
        style={{
          backgroundImage: `
            repeating-linear-gradient(45deg, rgba(13,110,77,0.03) 0, rgba(13,110,77,0.03) 1px, transparent 0, transparent 50%),
            repeating-linear-gradient(-45deg, rgba(13,110,77,0.03) 0, rgba(13,110,77,0.03) 1px, transparent 0, transparent 50%)
          `,
          backgroundSize: '24px 24px',
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left: copy */}
          <div className="flex-1 min-w-0">
            {/* Eyebrow */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6"
              style={{ backgroundColor: 'rgba(13,110,77,0.08)', color: '#0D6E4D' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              CBN-Compliant · Shariah-Certified · Canton Blockchain
            </div>

            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-5"
              style={{ letterSpacing: '-0.02em' }}
            >
              AI-Powered Murabahah Financing{' '}
              <span style={{ color: '#0D6E4D' }}>for Nigerian SMEs</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-xl">
              Vetify connects growing businesses with licensed financers through a fully digital,
              Shariah-compliant credit process — from onboarding to repayment, powered by AI.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#0D6E4D' }}
              >
                Apply for Financing
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm border-2 transition-colors"
                style={{ borderColor: '#0D6E4D', color: '#0D6E4D' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0D6E4D'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#0D6E4D'
                }}
              >
                Partner as a Financer
                <ArrowRight size={16} />
              </Link>
            </div>

            <p className="text-xs text-gray-500">
              ₦0 upfront · No interest · Shariah-certified by AAOIFI standards
            </p>
          </div>

          {/* Right: CSS product mockup */}
          <div className="flex-shrink-0 w-full lg:w-80 flex justify-center">
            <div className="relative">
              {/* Phone-card shell */}
              <div
                className="relative rounded-2xl p-5 w-72"
                style={{
                  backgroundColor: '#0A4A34',
                  backgroundImage: `
                    repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%),
                    repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%)
                  `,
                  backgroundSize: '16px 16px',
                  boxShadow: '0 24px 60px rgba(13,78,52,0.35), 0 8px 24px rgba(0,0,0,0.2)',
                }}
              >
                {/* Gold accent bar at top */}
                <div
                  className="h-0.5 w-full rounded-full mb-4"
                  style={{ background: 'linear-gradient(90deg, #C9A84C, #e8c97a, #C9A84C)' }}
                />

                {/* Vetify header in card */}
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: '#C9A84C' }}
                  >
                    <span className="text-white font-bold text-xs">V</span>
                  </div>
                  <span className="text-white/80 text-xs font-medium">Vetify</span>
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: 'rgba(201,168,76,0.2)', color: '#e8c97a' }}
                  >
                    Live
                  </span>
                </div>

                {/* Stage label */}
                <div className="mb-3">
                  <p className="text-white/50 text-xs mb-0.5">Application Progress</p>
                  <p className="text-white font-semibold text-sm">Stage 3 of 10 · Compliance Review</p>
                </div>

                {/* Progress dots — 3 green, 7 gray */}
                <div className="flex gap-1.5 mb-4">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 h-1.5 rounded-full"
                      style={{ backgroundColor: i < 3 ? '#0D6E4D' : 'rgba(255,255,255,0.15)' }}
                    />
                  ))}
                </div>

                {/* White inner card */}
                <div className="bg-white rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Active Contract</p>
                  <p className="text-xs font-medium text-gray-900 mb-2">Khalid Agro Supplies Ltd</p>
                  <div
                    className="h-0.5 rounded-full mb-2"
                    style={{ background: 'linear-gradient(90deg, #C9A84C 60%, #f0e8c8 100%)' }}
                  />
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-500">Outstanding</span>
                    <span className="text-sm font-bold" style={{ color: '#0D6E4D' }}>₦1,725,000</span>
                  </div>
                </div>
              </div>

              {/* Floating approval badge */}
              <div
                className="absolute -bottom-4 -right-6 rounded-xl px-4 py-2.5 flex items-center gap-2"
                style={{
                  backgroundColor: '#fff',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  border: '1px solid rgba(13,110,77,0.12)',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#0D6E4D' }}
                >
                  <CheckCircle2 size={11} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">₦2,450,000</p>
                  <p className="text-xs text-gray-500" style={{ fontSize: 10 }}>Approved</p>
                </div>
              </div>

              {/* Floating AI badge */}
              <div
                className="absolute -top-3 -left-5 rounded-xl px-3 py-2 flex items-center gap-1.5"
                style={{
                  backgroundColor: '#fff',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  border: '1px solid rgba(201,168,76,0.2)',
                }}
              >
                <Bot size={12} style={{ color: '#C9A84C' }} />
                <p className="text-xs font-medium text-gray-700">AI Scoring</p>
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: 'rgba(13,110,77,0.08)', color: '#0D6E4D' }}
                >
                  85
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <section className="py-8 px-5" style={{ backgroundColor: '#F3F4F6' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(13,110,77,0.1)' }}
                >
                  <Icon size={15} style={{ color: '#0D6E4D' }} />
                </div>
                <p className="text-xs font-medium text-gray-700 leading-snug">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-16 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3" style={{ letterSpacing: '-0.01em' }}>
              From Application to Financing in Days, Not Months
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              A fully digital, AI-assisted workflow from KYC to Murabahah contract execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, idx) => (
              <div key={step} className="relative">
                {/* Connecting arrow between cards (desktop) */}
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div
                    className="hidden md:flex absolute top-10 -right-3 z-10 w-6 h-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                  >
                    <ArrowRight size={12} className="text-gray-400" />
                  </div>
                )}

                <div
                  className="rounded-2xl p-6 h-full"
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* Step number */}
                  <div
                    className="text-4xl font-bold leading-none mb-4"
                    style={{ color: '#C9A84C', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {step}
                  </div>
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: 'rgba(13,110,77,0.08)' }}
                  >
                    <Icon size={18} style={{ color: '#0D6E4D' }} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Businesses / For Financers ── */}
      <section
        id="for-businesses"
        className="py-16 px-5"
        style={{ backgroundColor: '#F3F4F6' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* For SME Businesses */}
            <div
              className="rounded-2xl p-7"
              style={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
                style={{ backgroundColor: 'rgba(13,110,77,0.08)', color: '#0D6E4D' }}
              >
                <Building2 size={12} />
                For SME Businesses
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Get the financing your business needs — the Shariah way.
              </h3>
              <ul className="space-y-3 mb-6">
                {BUSINESS_BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#0D6E4D' }} />
                    <span className="text-sm text-gray-700">{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#0D6E4D' }}
              >
                Apply Now <ArrowRight size={14} />
              </Link>
            </div>

            {/* For Licensed Financers */}
            <div
              id="for-financers"
              className="rounded-2xl p-7"
              style={{
                backgroundColor: '#0A4A34',
                backgroundImage: `
                  repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%),
                  repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%)
                `,
                backgroundSize: '20px 20px',
              }}
            >
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
                style={{ backgroundColor: 'rgba(201,168,76,0.15)', color: '#e8c97a' }}
              >
                <Shield size={12} />
                For Licensed Financers
              </div>
              <h3 className="text-lg font-bold text-white mb-4">
                Deploy capital with confidence — AI-scored, blockchain-verified.
              </h3>
              <ul className="space-y-3 mb-6">
                {FINANCER_BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#C9A84C' }} />
                    <span className="text-sm text-white/80">{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'rgba(201,168,76,0.15)',
                  color: '#e8c97a',
                  border: '1px solid rgba(201,168,76,0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#C9A84C'
                  e.currentTarget.style.color = '#0A4A34'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(201,168,76,0.15)'
                  e.currentTarget.style.color = '#e8c97a'
                }}
              >
                Partner with Vetify <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section
        className="py-14 px-5"
        style={{ backgroundColor: '#0A4A34' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              { value: '₦2.4B+', label: 'Total Financing Facilitated' },
              { value: '340+', label: 'SMEs Financed' },
              { value: '< 48hrs', label: 'Average Decision Time' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div
                  className="text-3xl sm:text-4xl font-bold mb-1"
                  style={{ color: '#C9A84C' }}
                >
                  {value}
                </div>
                <p className="text-white/60 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-5 border-t border-gray-200" style={{ backgroundColor: '#fff' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
            <div>
              {/* Logo */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#0D6E4D' }}
                >
                  <span className="text-white font-bold text-xs">V</span>
                </div>
                <span className="font-semibold text-gray-900 text-sm">Vetify</span>
              </div>
              <p className="text-xs text-gray-500 max-w-xs">
                AI-powered Murabahah financing infrastructure on the Canton blockchain.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
              <div className="flex gap-5">
                {['Privacy Policy', 'Terms', 'CBN Disclosure'].map((link) => (
                  <a key={link} href="#" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                    {link}
                  </a>
                ))}
              </div>

              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(13,110,77,0.06)',
                  color: '#0D6E4D',
                  border: '1px solid rgba(13,110,77,0.12)',
                }}
              >
                <Link2 size={11} />
                Built on Canton Network
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
            © 2026 Vetify Ltd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
