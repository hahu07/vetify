import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { useRouter } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Star,
  TrendingUp,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect } from "react";

const features = [
  {
    icon: Building2,
    title: "Business Vetting",
    description:
      "CAC document verification, revenue analysis, and ethical business practices screening via Mono APIs.",
    href: "/register/business",
    cta: "Register as Business",
    accentClass: "bg-primary/10 dark:bg-primary/20",
    iconClass: "text-primary",
    borderHover: "hover:border-primary/40",
  },
  {
    icon: User,
    title: "Apply as Individual",
    description:
      "Seeking personal halal financing? Apply as an individual — BVN/NIN verification, Shariah compliance check, and matched financiers.",
    href: "/register/individual",
    cta: "Apply as Individual",
    accentClass:
      "bg-[var(--individual-accent,oklch(0.75_0.16_60))]/10 dark:bg-[var(--individual-accent,oklch(0.75_0.16_60))]/20",
    iconClass: "text-[var(--individual-accent,oklch(0.65_0.18_60))]",
    borderHover:
      "hover:border-[var(--individual-accent,oklch(0.75_0.16_60))]/40",
  },
  {
    icon: TrendingUp,
    title: "Financier Portal",
    description:
      "Access financing-ready profiles vetted to Shariah standards. Browse verified applicants.",
    href: "/register/financier",
    cta: "Join as Financier",
    accentClass: "bg-primary/10 dark:bg-primary/20",
    iconClass: "text-primary",
    borderHover: "hover:border-primary/40",
  },
];

const trustPoints = [
  "Shariah-compliant vetting process",
  "Decentralized on Internet Computer Protocol",
  "Transparent audit-ready profiles",
  "Nigeria & emerging markets focus",
];

export default function LandingPage() {
  const { isAuthenticated, isInitializing, login, isLoggingIn } = useAuth();
  const { role, isLoading } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || isInitializing || isLoading) return;
    if (role === "business") {
      router.navigate({ to: "/business/dashboard" });
    } else if (role === "individual") {
      router.navigate({ to: "/individual/dashboard" });
    } else if (role === "financier") {
      router.navigate({ to: "/financier/dashboard" });
    } else if (role === "admin") {
      router.navigate({ to: "/admin/dashboard" });
    }
  }, [isAuthenticated, role, isLoading, isInitializing, router]);

  return (
    <Layout hideNav={!isAuthenticated}>
      {/* Hero */}
      <section
        className="relative overflow-hidden bg-card border-b border-border dark:bg-card/90"
        data-ocid="landing.hero_section"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.5_0.22_135/0.08),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top_left,oklch(0.5_0.22_135/0.04),transparent_60%)]" />
        <div className="container mx-auto px-4 py-20 md:py-28 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <Badge
              variant="secondary"
              className="mb-5 inline-flex gap-1.5 border border-primary/30 bg-primary/10 text-primary"
            >
              <Star className="h-3 w-3" />
              Halal Finance Infrastructure
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Trusted Ethical Finance{" "}
              <span className="text-primary">Vetting</span> Platform
            </h1>
            <p className="mt-5 text-lg text-muted-foreground md:text-xl">
              Seamlessly connect and vet applicants according to Shariah
              principles. AI-powered profiling for ethical financiers in Nigeria
              and beyond.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {isAuthenticated ? (
                <Button
                  size="lg"
                  onClick={() => {
                    if (role === "financier") {
                      router.navigate({ to: "/financier/dashboard" });
                    } else if (role === "admin") {
                      router.navigate({ to: "/admin/dashboard" });
                    } else if (role === "individual") {
                      router.navigate({ to: "/individual/dashboard" });
                    } else {
                      router.navigate({ to: "/business/dashboard" });
                    }
                  }}
                  className="gap-2"
                  data-ocid="landing.go_to_dashboard_button"
                >
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={login}
                    disabled={isInitializing || isLoggingIn}
                    className="gap-2"
                    data-ocid="landing.signin_button"
                  >
                    <Lock className="h-4 w-4" />
                    {isInitializing
                      ? "Loading\u2026"
                      : isLoggingIn
                        ? "Connecting\u2026"
                        : "Sign In with Internet Identity"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Secure · Decentralized · Private
                  </span>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Cards */}
      <section
        className="bg-background py-16 md:py-20"
        data-ocid="landing.features_section"
      >
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-10 text-center"
          >
            <h2 className="font-display text-3xl font-bold text-foreground">
              Three Pathways to Ethical Finance
            </h2>
            <p className="mt-3 text-muted-foreground">
              Whether you seek financing as a business or individual, or provide
              it as a financier, Vetify has a path for you.
            </p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {features.map((feat, idx) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                <Card
                  className={`group h-full border-border ${feat.borderHover} hover:shadow-md transition-smooth dark:bg-card/80`}
                >
                  <CardHeader>
                    <div
                      className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg ${feat.accentClass}`}
                    >
                      <feat.icon className={`h-5 w-5 ${feat.iconClass}`} />
                    </div>
                    <CardTitle className="font-display text-lg">
                      {feat.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col justify-between gap-5">
                    <p className="text-sm text-muted-foreground">
                      {feat.description}
                    </p>
                    <Button
                      variant="outline"
                      className={`w-full gap-2 transition-colors ${
                        feat.title === "Apply as Individual"
                          ? "group-hover:border-[var(--individual-accent,oklch(0.75_0.16_60))] group-hover:text-[var(--individual-accent,oklch(0.65_0.18_60))]"
                          : "group-hover:border-primary group-hover:text-primary"
                      }`}
                      onClick={() =>
                        router.navigate({
                          to: feat.href as Parameters<
                            typeof router.navigate
                          >[0]["to"],
                        })
                      }
                      data-ocid={`landing.${feat.title.toLowerCase().replace(/\s/g, "_")}_cta`}
                    >
                      {feat.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section
        className="bg-muted/40 py-16 md:py-20"
        data-ocid="landing.trust_section"
      >
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Built on Trust & Transparency
                </h2>
              </div>
              <p className="mb-7 text-muted-foreground">
                Vetify combines decentralized technology with deep ethical
                finance expertise to create a platform you can rely on.
              </p>
              <ul className="space-y-3">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
              {!isAuthenticated && (
                <Button
                  size="lg"
                  className="mt-8 gap-2"
                  onClick={login}
                  disabled={isInitializing || isLoggingIn}
                  data-ocid="landing.trust_cta_button"
                >
                  Get Started Today <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
