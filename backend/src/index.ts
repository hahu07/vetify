import "dotenv/config";
import express from "express";
import cors from "cors";
import onboardingRoutes from "./routes/onboarding.js";
import financingRoutes from "./routes/financing.js";
import contractRoutes from "./routes/contracts.js";
import policyRoutes from "./routes/policy.js";
import providerRoutes from "./routes/providers.js";
import authRoutes from "./routes/auth.js";
import webhookRoutes from "./routes/webhooks.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app  = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Stages 1–4: Onboarding → Verification → Compliance → Approved Borrower
app.use("/api/onboarding", onboardingRoutes);

// Stages 5–7: Financing Request → Underwriting → FI Approval
app.use("/api/financing", financingRoutes);

// Stages 8–10: Murabahah Contract → Repayments → Closure + Portfolio Reports
app.use("/api/contracts", contractRoutes);

// Cross-cutting: scoring-policy propose/approve/reject + PolicyApprover registry
app.use("/api/policy", policyRoutes);

// Stage 0: Financing Provider onboarding + AuthorizedOfficer registry (gates ApproveFunding)
app.use("/api/providers", providerRoutes);

// Layer 3 of the Policy-Approval Security Roadmap: human login, session tokens
app.use("/api/auth", authRoutes);

// Inbound third-party webhooks (mono.co creditworthiness — see webhooks.ts)
app.use("/api/webhooks", webhookRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Vetify API] Listening on http://localhost:${PORT}`);
});
