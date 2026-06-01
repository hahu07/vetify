import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            data-ocid="privacy.back_home_link"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
          <span className="font-display text-lg font-bold tracking-tight text-primary">
            Vetify
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: 1 June 2026
          </p>
          <div className="mt-4 h-px bg-border" />
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">
              1. Information We Collect
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Vetify collects the following categories of personal and financial
              information to operate the vetting and matching service:
            </p>
            <ul className="mt-3 space-y-1 pl-5 text-muted-foreground list-disc">
              <li>
                <strong className="text-foreground">Identity data:</strong> Full
                name, date of birth, BVN (Bank Verification Number), NIN
                (National Identification Number), passport or government-issued
                ID photograph.
              </li>
              <li>
                <strong className="text-foreground">Business data:</strong> CAC
                registration number, TIN (Tax Identification Number), business
                type, year of incorporation, director information, and business
                description.
              </li>
              <li>
                <strong className="text-foreground">Financial data:</strong>{" "}
                Annual revenue, monthly income, bank account information,
                transaction history (via Mono API), and financing amount sought.
              </li>
              <li>
                <strong className="text-foreground">Contact data:</strong> Phone
                number, email address, physical address.
              </li>
              <li>
                <strong className="text-foreground">Usage data:</strong> Login
                timestamps, IP addresses, and interaction logs for security and
                audit compliance.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              2. How We Use Your Information
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Your information is used exclusively for the following purposes:
            </p>
            <ul className="mt-3 space-y-1 pl-5 text-muted-foreground list-disc">
              <li>
                <strong className="text-foreground">
                  Vetting and compliance:
                </strong>{" "}
                Our AI agent Tawthiq (التوثيق) uses your identity and business
                data to screen for KYC/KYB compliance, Shariah compliance, and
                watchlist checks.
              </li>
              <li>
                <strong className="text-foreground">Risk scoring:</strong> Our
                agent Mizan (الميزان) analyses financial behaviour, income
                stability, and repayment capacity to generate a risk score.
              </li>
              <li>
                <strong className="text-foreground">Matching:</strong> Our agent
                Kashif (الكاشف) matches your profile to suitable financiers
                based on your financing needs and their preferences.
              </li>
              <li>
                <strong className="text-foreground">Communication:</strong> We
                may send status updates via WhatsApp (with your consent)
                regarding your application progress.
              </li>
              <li>
                <strong className="text-foreground">
                  Platform improvement:
                </strong>{" "}
                Aggregated, anonymised data may be used to improve our
                algorithms and services.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              3. Data Sharing
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Vetify does not sell your personal data. Your information is
              shared only in the following limited circumstances:
            </p>
            <ul className="mt-3 space-y-1 pl-5 text-muted-foreground list-disc">
              <li>
                <strong className="text-foreground">
                  Consented financiers:
                </strong>{" "}
                When your profile is marked as "Financing Ready", a
                privacy-filtered summary may be visible to verified financiers
                on the Platform. You control which fields are shared via your
                Privacy Settings.
              </li>
              <li>
                <strong className="text-foreground">
                  Third-party verification providers:
                </strong>{" "}
                Identity verification is performed via Mono API. Only the data
                necessary for verification is transmitted.
              </li>
              <li>
                <strong className="text-foreground">Legal obligation:</strong>{" "}
                We may disclose data if required by law, court order, or
                regulatory authority in Nigeria.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              4. Data Retention
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We retain your personal data for as long as your account is active
              or as required by Nigerian law (including the NDPR 2019). Upon
              account closure request, we will delete or anonymise your personal
              data within 30 days, except where retention is required by law for
              audit, fraud prevention, or regulatory compliance purposes.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Financial transaction records may be retained for up to 6 years in
              accordance with Nigerian financial regulations. You may request
              deletion of non-mandatory records at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              5. Security
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Vetify is built on the Internet Computer Protocol (ICP), a
              decentralised blockchain infrastructure that provides:
            </p>
            <ul className="mt-3 space-y-1 pl-5 text-muted-foreground list-disc">
              <li>
                End-to-end encryption for all data in transit and at rest.
              </li>
              <li>
                Canister-level access controls — your data is accessible only by
                authenticated principals.
              </li>
              <li>
                Immutable audit trails for all data access and administrative
                actions.
              </li>
              <li>
                No centralised server that can be compromised by a single
                attack.
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Despite these measures, no system is completely immune to risk.
              You are responsible for maintaining the security of your Internet
              Identity login.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              6. Your Rights (NDPR)
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Under the Nigeria Data Protection Regulation (NDPR) 2019, you have
              the following rights:
            </p>
            <ul className="mt-3 space-y-1 pl-5 text-muted-foreground list-disc">
              <li>
                <strong className="text-foreground">Right of access:</strong>{" "}
                You may request a copy of the personal data we hold about you.
              </li>
              <li>
                <strong className="text-foreground">
                  Right to rectification:
                </strong>{" "}
                You may request correction of inaccurate or incomplete data.
              </li>
              <li>
                <strong className="text-foreground">Right to deletion:</strong>{" "}
                You may request erasure of your personal data (subject to legal
                retention obligations).
              </li>
              <li>
                <strong className="text-foreground">Right to object:</strong>{" "}
                You may object to processing for specific purposes, including
                marketing or profiling.
              </li>
              <li>
                <strong className="text-foreground">
                  Right to data portability:
                </strong>{" "}
                You may request your data in a structured, machine-readable
                format.
              </li>
              <li>
                <strong className="text-foreground">
                  Right to withdraw consent:
                </strong>{" "}
                Where processing is based on consent, you may withdraw it at any
                time.
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              To exercise any of these rights, contact our Data Protection
              Officer at dpo@vetify.finance. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              7. Cookies and Tracking
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Vetify uses minimal client-side storage (localStorage) solely for
              user preference persistence (dark mode, session state). We do not
              use third-party advertising cookies or cross-site tracking
              technologies. No analytics SDK that transmits data to third
              parties is used by default.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              8. Contact and Data Protection Officer
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              For all privacy-related enquiries, including data access,
              correction, or deletion requests, contact:
            </p>
            <div className="mt-3 rounded-lg border border-border bg-muted/40 p-4">
              <p className="font-medium text-foreground">
                Data Protection Officer — Vetify
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Email: dpo@vetify.finance
              </p>
              <p className="text-sm text-muted-foreground">
                Address: Lagos, Nigeria
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                You also have the right to lodge a complaint with the National
                Information Technology Development Agency (NITDA), the Nigerian
                data protection supervisory authority, at{" "}
                <a
                  href="https://nitda.gov.ng"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  nitda.gov.ng
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border bg-muted/40 py-6">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "vetify")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
