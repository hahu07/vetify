import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  ShieldCheck,
  Link2,
  Bot,
  Building2,
  Menu,
  X,
  BookOpen,
  UserCheck,
  ChevronDown,
} from 'lucide-react'
import HowItWorksStepper from '../components/HowItWorksStepper'

const NAV_LINKS = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'For Businesses', href: '#for-businesses' },
  { label: 'For Financers', href: '#for-financers' },
  { label: 'FAQ', href: '#faq' },
]

const TRUST_ITEMS = [
  { icon: Building2, label: 'Non-Interest Finance Framework' },
  { icon: CheckCircle2, label: 'AAOIFI Shariah Standards' },
  { icon: Link2, label: 'Blockchain — Verified' },
  { icon: Bot, label: 'AI Powered' },
]

const BUSINESS_BENEFITS = [
  'Shariah-compliant — no Riba (interest), ever',
  'Fast decision — typically under 48 hours',
  'Fully digital — no paper forms, no branch visits',
  'Transparent pricing — all costs disclosed upfront',
  'Every contract certified under AAOIFI Standard No. 8',
]

const FINANCER_BENEFITS = [
  'AI-scored risk — DSCR + cash flow + fraud-pattern analysis',
  'Immutable audit trail on the Canton blockchain',
  'Compliant reporting built in',
  'Real-time delinquency monitoring',
  'RegTech-ready — one-click portfolio & compliance reports',
]

const GOVERNANCE_ITEMS = [
  {
    icon: BookOpen,
    title: 'Independent Shariah oversight',
    desc: 'A Shariah Supervisory Board, independent of Vetify itself, certifies the exact cost, profit margin, and tenure of every Murabahah contract before a business can accept it — not just the business’s sector, the actual figures.',
  },
  {
    icon: UserCheck,
    title: 'Human decision-makers, always',
    desc: 'Our AI agents only gather and structure evidence. A deterministic scoring engine computes every risk score, and a licensed human — our verification team, or your own credit officer — makes the final call.',
  },
  {
    icon: Link2,
    title: 'Immutable audit trail',
    desc: 'Every approval, contract, and repayment is recorded on the Canton blockchain — visible to regulators in real time, and impossible to quietly rewrite after the fact.',
  },
  {
    icon: ShieldCheck,
    title: 'Maker-checker governance',
    desc: 'Changes to our own credit-scoring policies require sign-off from a registered Risk & Credit Governance Committee member, distinct from whoever proposed them.',
  },
]

const FAQ_ITEMS = [
  {
    q: 'What is Murabahah financing, and how is it different from a loan?',
    a: 'Murabahah is a cost-plus-sale structure, not a loan. Your financier purchases the asset you need on your behalf, then sells it to you at a disclosed cost plus an agreed, fixed profit margin — repaid in instalments. No interest ever accrues on a balance.',
  },
  {
    q: 'Is this genuinely interest-free, or is the profit margin just interest by another name?',
    a: 'The profit margin is fixed and disclosed upfront as part of a real sale of a real asset — not interest accrued on a cash loan. Every contract’s specific cost, margin, and tenure is independently certified by our Shariah Supervisory Board against AAOIFI Standard No. 8 before you can accept it.',
  },
  {
    q: 'How much of the decision is really made by AI?',
    a: 'Our AI agents only gather and structure evidence — they never hold authority to approve or reject anything. A separate, deterministic scoring engine computes every risk score from that evidence, and a licensed human always makes the final call.',
  },
  {
    q: 'What happens if I miss a repayment?',
    a: 'A single missed instalment is treated as routine follow-up, not default. Two or more missed instalments trigger a review by a human portfolio officer, and any late-payment charity contribution follows a Shariah-compliant formula — it is never retained as profit by your financier.',
  },
  {
    q: 'Who regulates Vetify, and how is my data protected?',
    a: 'Vetify operates under the CBN’s Non-Interest Financial Institutions framework. Every contract lives on Canton, a blockchain built for regulated finance, where sub-transaction privacy means your data is only ever visible to you, your financier, and Vetify’s own compliance team.',
  },
]

const STATS = [
  { value: 2.4, decimals: 1, prefix: '₦', suffix: 'B+', label: 'Total Financing Facilitated' },
  { value: 340, decimals: 0, prefix: '', suffix: '+', label: 'SMEs Financed' },
  { value: 48, decimals: 0, prefix: '< ', suffix: 'hrs', label: 'Average Decision Time' },
]

/**
 * Fades + slides an element up the first time it scrolls into view.
 *
 * Defaults to visible: content that's already on-screen at mount (or that never gets a chance
 * to be observed at all — no-scroll render contexts, a slow/failed observer) must never end up
 * permanently blank, so only content confirmed off-screen at mount is hidden pending intersection,
 * and a fallback timer forces visibility regardless after 2.5s as a hard safety net.
 */
function useReveal<T extends HTMLElement>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (el.getBoundingClientRect().top < window.innerHeight * 1.05) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(el)

    const fallback = window.setTimeout(() => setVisible(true), 2500)

    return () => {
      observer.disconnect()
      window.clearTimeout(fallback)
    }
  }, [])

  return [ref, visible]
}

function Reveal({
  children,
  className = '',
  delay = 0,
  id,
  style,
}: {
  children: ReactNode
  className?: string
  delay?: number
  id?: string
  style?: CSSProperties
}) {
  const [ref, visible] = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      id={id}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
      style={{ ...style, transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}

/** Animates 0 -> target once `active` flips true; used to bring the stats bar to life on scroll. */
function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return
    let start: number | null = null
    let raf = 0
    const tick = (ts: number) => {
      if (start === null) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])

  return value
}

function StatCounter({
  value,
  decimals,
  prefix,
  suffix,
  active,
}: {
  value: number
  decimals: number
  prefix: string
  suffix: string
  active: boolean
}) {
  const current = useCountUp(value, active)
  return (
    <span className="font-display">
      {prefix}
      {current.toFixed(decimals)}
      {suffix}
    </span>
  )
}

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {FAQ_ITEMS.map(({ q, a }, idx) => {
        const open = openIndex === idx
        return (
          <div key={q}>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-7 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : idx)}
            >
              <span className="font-semibold text-gray-900 text-sm sm:text-base">{q}</span>
              <ChevronDown
                size={18}
                className={`flex-shrink-0 text-primary transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ease-in-out motion-reduce:transition-none ${
                open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-5 sm:px-7 pb-5 text-sm text-gray-600 leading-relaxed max-w-2xl">{a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const LATTICE_BG = {
  backgroundImage: `
    repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%),
    repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%)
  `,
  backgroundSize: '20px 20px',
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [statsRef, statsVisible] = useReveal<HTMLDivElement>()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-surface font-sans text-gray-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* ── Navigation ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-200 ${
          scrolled ? 'shadow-[0_1px_12px_rgba(0,0,0,0.08)]' : 'shadow-[0_1px_0_rgba(0,0,0,0.06)]'
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 flex items-center h-16 gap-8">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 mr-auto lg:mr-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm font-display">V</span>
            </div>
            <span className="font-semibold text-gray-900 tracking-tight">Vetify</span>
          </Link>

          <div className="hidden lg:flex items-center gap-7 mx-auto">
            {NAV_LINKS.map(({ label, href }) => (
              <a key={label} href={href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                {label}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link to="/login" className="btn-outline px-4 py-1.5 text-sm">
              Login
            </Link>
            <Link to="/signup?role=business" className="btn-primary px-4 py-1.5 text-sm">
              Apply Now
            </Link>
          </div>

          <button
            className="lg:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-5 py-4 space-y-3">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="block text-sm text-gray-700 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/login" className="btn-outline justify-center py-2">
                Login
              </Link>
              <Link to="/signup?role=business" className="btn-primary justify-center py-2">
                Apply Now
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main id="main-content">
        {/* ── Hero ── */}
        <section
          className="pt-32 pb-24 px-5"
          style={{
            backgroundImage: `
              repeating-linear-gradient(45deg, rgba(13,110,77,0.03) 0, rgba(13,110,77,0.03) 1px, transparent 0, transparent 50%),
              repeating-linear-gradient(-45deg, rgba(13,110,77,0.03) 0, rgba(13,110,77,0.03) 1px, transparent 0, transparent 50%)
            `,
            backgroundSize: '24px 24px',
          }}
        >
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-14 lg:gap-16">
            {/* Left: copy */}
            <div className="flex-1 min-w-0 lg:pr-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6 bg-primary/10 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Regulatory-Compliant · Shariah-Certified · Canton Blockchain
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold text-gray-900 leading-[1.08] tracking-tight mb-6">
                Technology-Enabled Private<br className="hidden sm:block" />
                <span className="text-primary">Credit Infrastructure</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-xl">
                Vetify pairs AAOIFI-certified Murabahah structuring with AI-assisted underwriting on the
                Canton blockchain — so licensed financial institutions can fund Nigerian SMEs with full
                Shariah confidence and a complete, tamper-proof audit trail.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Link to="/signup?role=business" className="btn-primary px-6 py-3 text-sm">
                  Apply for Financing
                  <ArrowRight size={16} />
                </Link>
                <Link to="/signup?role=financer" className="btn-outline px-6 py-3 text-sm">
                  Partner as a Financer
                  <ArrowRight size={16} />
                </Link>
              </div>

              <p className="text-xs text-gray-500">
                ₦0 upfront · No interest, ever · Every contract Shariah-certified by an independent board
              </p>
            </div>

            {/* Right: product mockup */}
            <div className="flex-shrink-0 w-full lg:w-80 flex justify-center">
              <div className="relative">
                <div className="relative rounded-2xl p-5 w-72 bg-primary-dark shadow-[0_24px_60px_rgba(13,78,52,0.35),0_8px_24px_rgba(0,0,0,0.2)]" style={LATTICE_BG}>
                  <div className="h-0.5 w-full rounded-full mb-4 bg-gradient-to-r from-accent-400 via-accent-200 to-accent-400" />

                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-md bg-accent-400 flex items-center justify-center">
                      <span className="text-white font-bold text-xs font-display">V</span>
                    </div>
                    <span className="text-white/80 text-xs font-medium">Vetify</span>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium bg-accent-400/20 text-accent-200">
                      Live
                    </span>
                  </div>

                  <div className="mb-3">
                    <p className="text-white/50 text-xs mb-0.5">Application Progress</p>
                    <p className="text-white font-semibold text-sm">Stage 3 of 10 · Compliance Review</p>
                  </div>

                  <div className="flex gap-1.5 mb-4">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-1.5 rounded-full ${i < 3 ? 'bg-primary-400' : 'bg-white/15'}`}
                      />
                    ))}
                  </div>

                  <div className="bg-white rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">Active Contract</p>
                    <p className="text-xs font-medium text-gray-900 mb-2">Khalid Agro Supplies Ltd</p>
                    <div className="h-0.5 rounded-full mb-2 bg-gradient-to-r from-accent-400 via-accent-100 to-accent-100" />
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-500">Outstanding</span>
                      <span className="text-sm font-bold text-primary">₦1,725,000</span>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-4 -right-6 rounded-xl px-4 py-2.5 flex items-center gap-2 bg-white border border-primary/10 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={11} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">₦2,450,000</p>
                    <p className="text-gray-500" style={{ fontSize: 10 }}>Approved</p>
                  </div>
                </div>

                <div className="absolute -top-3 -left-5 rounded-xl px-3 py-2 flex items-center gap-1.5 bg-white border border-accent-400/20 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
                  <Bot size={12} className="text-accent-400" />
                  <p className="text-xs font-medium text-gray-700">AI Scoring</p>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">85</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Compliance strip ── */}
        <section className="py-8 px-5 bg-gray-100">
          <div className="max-w-6xl mx-auto">
            <p className="text-center text-xs font-semibold tracking-wider uppercase text-gray-400 mb-6">
              Governed &amp; Verified By
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 lg:gap-x-8 lg:divide-x lg:divide-gray-200">
              {TRUST_ITEMS.map(({ icon: Icon, label }, i) => (
                <div key={label} className="flex items-center gap-3 lg:pl-8 lg:first:pl-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      i % 2 === 0 ? 'bg-primary' : 'bg-accent-400'
                    }`}
                  >
                    <Icon size={15} className={i % 2 === 0 ? 'text-white' : 'text-primary-900'} />
                  </div>
                  <p className="text-xs font-medium text-gray-700 leading-snug">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works (timeline) ── */}
        <section id="how-it-works" className="py-20 px-5">
          <div className="max-w-5xl mx-auto">
            <Reveal className="text-center mb-14">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-gray-900 mb-3 tracking-tight">
                From Application to Financing in Days, Not Months
              </h2>
              <p className="text-gray-500 text-sm max-w-xl mx-auto">
                A fully digital, AI-assisted workflow from KYC to Murabahah contract execution.
              </p>
            </Reveal>

            <Reveal delay={100}>
              <HowItWorksStepper />
            </Reveal>
          </div>
        </section>

        {/* ── For Businesses / For Financers ── */}
        <section id="for-businesses" className="py-20 px-5 bg-gray-100">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Reveal className="rounded-2xl p-7 bg-white border border-gray-200 shadow-card">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5 bg-primary/10 text-primary">
                  <Building2 size={12} />
                  For SME Businesses
                </div>
                <h3 className="font-display text-lg font-semibold text-gray-900 mb-4">
                  Get the financing your business needs — the Shariah way.
                </h3>
                <ul className="space-y-3 mb-6">
                  {BUSINESS_BENEFITS.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5 text-primary" />
                      <span className="text-sm text-gray-700">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup?role=business" className="btn-primary px-5 py-2.5 text-sm">
                  Apply Now <ArrowRight size={14} />
                </Link>
              </Reveal>

              <Reveal delay={120} id="for-financers" className="rounded-2xl p-7 bg-primary-dark" style={LATTICE_BG}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5 bg-accent-400/15 text-accent-200">
                  <Shield size={12} />
                  For Licensed Financers
                </div>
                <h3 className="font-display text-lg font-semibold text-white mb-4">
                  Deploy capital with confidence — AI-scored, blockchain-verified.
                </h3>
                <ul className="space-y-3 mb-6">
                  {FINANCER_BENEFITS.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5 text-accent-400" />
                      <span className="text-sm text-white/80">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup?role=financer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors bg-accent-400/15 text-accent-200 border border-accent-400/30 hover:bg-accent-400 hover:text-primary-900"
                >
                  Partner with Vetify <ArrowRight size={14} />
                </Link>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Governance & Trust ── */}
        <section className="py-20 px-5">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5 bg-primary/10 text-primary">
                Governance
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-gray-900 mb-4 tracking-tight leading-tight">
                Every decision has a name behind it.
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed max-w-md">
                Vetify pairs AI-assisted evidence-gathering with real human and institutional authority at
                every stage — and Canton's ledger makes that trail impossible to alter after the fact.
              </p>
            </Reveal>

            <div className="lg:col-span-7 divide-y divide-gray-200 border-t border-gray-200">
              {GOVERNANCE_ITEMS.map(({ icon: Icon, title, desc }, idx) => (
                <Reveal key={title} delay={idx * 80} className="flex items-start gap-4 py-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1.5">{title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="py-14 px-5 bg-primary-dark" ref={statsRef}>
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              {STATS.map(({ value, decimals, prefix, suffix, label }) => (
                <div key={label}>
                  <div className="text-3xl sm:text-4xl font-bold mb-1 text-accent-400">
                    <StatCounter value={value} decimals={decimals} prefix={prefix} suffix={suffix} active={statsVisible} />
                  </div>
                  <p className="text-white/60 text-sm">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="py-20 px-5">
          <div className="max-w-3xl mx-auto">
            <Reveal className="text-center mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-gray-900 mb-3 tracking-tight">
                Common Questions
              </h2>
              <p className="text-gray-500 text-sm max-w-xl mx-auto">
                Straight answers about how the Shariah structure, the AI agents, and the regulation actually work.
              </p>
            </Reveal>
            <Reveal>
              <FaqAccordion />
            </Reveal>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-16 px-5 bg-primary-dark" style={LATTICE_BG}>
          <Reveal className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white mb-4 tracking-tight">
              Ready to grow without compromise?
            </h2>
            <p className="text-white/70 text-sm sm:text-base mb-8 max-w-xl mx-auto">
              Join Nigerian SMEs and licensed financial institutions already transacting on Vetify's
              Shariah-certified, blockchain-audited financing rail.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/signup?role=business"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-accent-400 text-primary-900 hover:bg-accent-300 transition-colors"
              >
                Apply for Financing <ArrowRight size={16} />
              </Link>
              <Link
                to="/signup?role=financer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold border-2 border-white/30 text-white hover:bg-white/10 transition-colors"
              >
                Partner as a Financer <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="py-12 px-5 border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-white font-bold text-xs font-display">V</span>
                </div>
                <span className="font-semibold text-gray-900 text-sm">Vetify</span>
              </div>
              <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                AI-powered Murabahah financing infrastructure on the Canton blockchain.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Product</p>
              <div className="flex flex-col gap-2">
                {NAV_LINKS.map(({ label, href }) => (
                  <a key={label} href={href} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Legal</p>
              <div className="flex flex-col gap-2">
                {['Privacy Policy', 'Terms', 'Disclosure'].map((link) => (
                  <a key={link} href="#" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                    {link}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Compliance</p>
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/[0.06] text-primary border border-primary/10"
              >
                <Link2 size={11} />
                Built on Canton Network
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
            © 2026 Vetify Ltd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
