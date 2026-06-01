import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const TERMS_CONTENT = `By using Vetify, you agree to the following:

1. Platform Use
Vetify provides financing vetting and profiling services; it does not lend directly.

2. Accuracy of Information
You confirm that all information submitted is true, accurate, and complete. Providing false information may result in immediate disqualification.

3. KYC/KYB Consent
You consent to Vetify verifying your identity via BVN, NIN, CAC, TIN, and credit data through our verification partners (Mono).

4. Shariah Compliance Screening
Your application will be reviewed for compliance with Islamic finance principles by our AI agent Tawthiq.

5. Data Sharing
Your verified profile may be shared with matched financiers on the platform upon your consent at the matching stage.

6. Platform Decisions
Vetify's AI-assisted decisions are advisory. Final financing decisions are made by financiers.

7. Limitation of Liability
Vetify is not liable for financing outcomes, third-party actions, or data provided by verification partners.

8. Account Termination
Vetify reserves the right to suspend accounts that violate these terms.`;

const PRIVACY_CONTENT = `Vetify collects and processes your personal and financial data for the purposes of ethical finance vetting.

1. Data Collected
Identity data (name, BVN, NIN, DOB, address), financial data (income, bank statements, transaction history), business data (CAC, TIN, directors, financials) where applicable.

2. How We Use Your Data
To verify your identity, assess your financing eligibility, screen for Shariah compliance, and match you with suitable financiers.

3. Data Sharing
Your data is shared only with: (a) our verification partners (Mono) for KYC/KYB checks, (b) matched financiers, only with your explicit consent at the deal stage.

4. NDPR Rights
Under the Nigeria Data Protection Regulation, you have the right to access your data, request corrections, request deletion, and data portability. Submit requests via your account settings.

5. Data Retention
Your data is retained for the duration of your account and for up to 5 years after account closure for regulatory compliance.

6. Security
Data is stored on the Internet Computer blockchain platform with cryptographic security.

7. Contact
For privacy inquiries, contact privacy@vetify.finance.`;

interface TermsModalProps {
  type: "terms" | "privacy";
  triggerText?: string;
  triggerClassName?: string;
  ocid?: string;
}

export function TermsModal({
  type,
  triggerText,
  triggerClassName,
  ocid,
}: TermsModalProps) {
  const isTerms = type === "terms";
  const title = isTerms ? "Terms and Conditions" : "Privacy Policy";
  const content = isTerms ? TERMS_CONTENT : PRIVACY_CONTENT;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`underline font-medium hover:opacity-80 ${triggerClassName || ""}`}
          data-ocid={ocid}
        >
          {triggerText || title}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {content.split("\n\n").map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        </ScrollArea>
        <div className="pt-4 border-t border-border">
          <Button type="button" className="w-full">
            I Understand
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
