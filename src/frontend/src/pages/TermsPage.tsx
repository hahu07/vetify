import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            data-ocid="terms.back_home_link"
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
            Terms and Conditions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: 1 June 2026
          </p>
          <div className="mt-4 h-px bg-border" />
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">
              1. Acceptance of Terms
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              By accessing or using the Vetify platform ("Platform"), you agree
              to be bound by these Terms and Conditions. If you do not agree to
              all of these terms, you may not access or use the Platform. Vetify
              reserves the right to amend these terms at any time, and your
              continued use of the Platform constitutes acceptance of such
              amendments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              2. Use of the Platform
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              The Vetify Platform is a halal and ethical finance vetting
              service. It does not provide financing directly. The Platform
              facilitates assessment, verification, and profiling of financing
              applicants for ethical financial institutions. You agree to use
              the Platform solely for lawful purposes and in accordance with
              these Terms. You must not misuse the Platform, introduce malicious
              software, or attempt to gain unauthorised access to any part of
              the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              3. User Accounts and Registration
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              To access the Platform, you must register an account using
              Internet Identity authentication. You are responsible for
              maintaining the confidentiality of your account and for all
              activities that occur under it. You must provide accurate,
              current, and complete information during registration. Vetify
              reserves the right to suspend or terminate your account if any
              information provided is found to be inaccurate, false, or
              misleading.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Registration requires submission of personal or business identity
              data, including BVN (Bank Verification Number), NIN (National
              Identification Number), and CAC documentation for business
              applicants. By submitting this data, you consent to its use for
              verification purposes as described in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              4. Financing Application Process
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Vetify's AI agents — Tawthiq (verification), Mizan (risk scoring),
              and Kashif (matching) — assess your application based on submitted
              data. These assessments are advisory and do not constitute a
              guarantee of financing. Decisions by individual financiers remain
              entirely at their own discretion.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Vetify operates as a neutral intermediary and is not a party to
              any financing agreement between an applicant and a financier. We
              do not accept liability for the actions or decisions of any
              financier using the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              5. Data Collection and Privacy
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              By using the Platform, you consent to the collection and use of
              your personal and financial data as outlined in our{" "}
              <Link
                to="/privacy"
                className="text-primary hover:underline"
                data-ocid="terms.privacy_link"
              >
                Privacy Policy
              </Link>
              . Your data is stored securely on the Internet Computer Protocol
              (ICP) infrastructure and is processed only for the purposes of
              vetting and matching.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              6. Intellectual Property
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              All content, branding, software, and materials on the Vetify
              Platform are the intellectual property of Vetify and its
              licensors. You may not copy, reproduce, distribute, or create
              derivative works without express written permission. The names and
              concepts of the AI agents Tawthiq, Mizan, and Kashif are
              proprietary to Vetify.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              7. Limitation of Liability
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              To the maximum extent permitted by applicable law, Vetify shall
              not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of, or
              inability to use, the Platform. Vetify's total liability for any
              claim arising out of or relating to the Platform shall not exceed
              the fees paid by you to Vetify in the twelve months preceding the
              claim.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              The Platform is provided on an "as is" and "as available" basis
              without warranties of any kind, express or implied.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              8. Governing Law
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              These Terms shall be governed by and construed in accordance with
              the laws of the Federal Republic of Nigeria. The Platform operates
              in compliance with the Nigeria Data Protection Regulation (NDPR)
              2019 and its subsequent amendments. Any dispute arising from these
              Terms shall be subject to the exclusive jurisdiction of the courts
              of Lagos State, Nigeria.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Where applicable, the Platform also complies with the requirements
              of the Central Bank of Nigeria (CBN) guidelines on digital
              financial services and relevant Securities and Exchange Commission
              (SEC) regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              9. Contact Information
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              If you have questions about these Terms or wish to exercise your
              legal rights, please contact us:
            </p>
            <div className="mt-3 rounded-lg border border-border bg-muted/40 p-4">
              <p className="font-medium text-foreground">Vetify</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Email: legal@vetify.finance
              </p>
              <p className="text-sm text-muted-foreground">
                Address: Lagos, Nigeria
              </p>
              <p className="text-sm text-muted-foreground">
                For data protection enquiries, contact our Data Protection
                Officer at: dpo@vetify.finance
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
