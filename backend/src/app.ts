/**
 * Express app assembly — split from index.ts (review gap G8) so route tests
 * can import the app and drive it with supertest without binding a port or
 * running startup config validation (that stays in index.ts, the actual
 * server entry point).
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import onboardingRoutes from "./routes/onboarding.js";
import financingRoutes from "./routes/financing.js";
import contractRoutes from "./routes/contracts.js";
import policyRoutes from "./routes/policy.js";
import providerRoutes from "./routes/providers.js";
import authRoutes from "./routes/auth.js";
import webhookRoutes from "./routes/webhooks.js";
import documentRoutes from "./routes/documents.js";
import notificationRoutes from "./routes/notifications.js";
import devRoutes from "./routes/dev.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./auth.js";
import { logger } from "./logger.js";
import { registry, httpRequestDuration, httpRequestsTotal } from "./metrics.js";
import { pool as appPool } from "./appdb.js";
import { pool as pqsPool, readsViaLedger } from "./pqs.js";
import { idempotencyMiddleware } from "./idempotency.js";

export function buildApp() {
  const app = express();

  // Response-header hardening flagged in the Security Audit section of the
  // Phase 3 Enterprise Production Readiness Audit (2026-07-08) but not
  // wired up at the time. Default config: this is a JSON-only API with no
  // HTML views to script-inject into, so helmet's default CSP is a no-op
  // safety net rather than something tuned for a specific page; the
  // concrete win is the rest of the default set (X-Content-Type-Options,
  // X-Frame-Options, etc.). TLS termination itself happens upstream of this
  // process (a reverse proxy / load balancer) — this app doesn't speak TLS
  // directly, so HSTS is only meaningful once that's in place.
  app.use(helmet());

  // Comma-separated so a deployed frontend (e.g. a Vercel URL) can be allowed
  // alongside the local dev origin at the same time, without needing a code
  // change to swap between them.
  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(cors({ origin: corsOrigins }));

  // Structured, per-request logging (audit finding C-2). Attaches req.id /
  // req.log, both consumed by errorHandler.ts so a client-visible
  // correlation ID and the server-side structured log line are the exact
  // same identifier, not two independently-generated ones.
  //
  // Deliberately mounted BEFORE express.json() — found live-testing the
  // policy/advisor registration flow (8 Jul 2026): a malformed JSON body
  // makes express.json() throw before the next middleware ever runs, so
  // with pino-http mounted after it, a bad request produced a completely
  // unlogged 500 with correlationId "unknown" (req.id was never set,
  // req.log?.error() silently no-op'd on the missing logger). Mounting
  // logging first means every request — including one that fails parsing
  // its own body — gets a real ID and a real log line.
  app.use(pinoHttp({
    logger,
    // Always server-generated, never trust a client-supplied request ID for
    // something used as a security-relevant correlation identifier in logs.
    genReqId: () => randomUUID(),
  }));

  // Default 100kb is fine for every route except documents.ts's base64 file
  // upload — base64 inflates raw bytes by ~33%, so 12mb of JSON body caps the
  // real uploaded file at documents.ts's own 8MB MAX_FILE_BYTES with headroom.
  app.use(express.json({ limit: "12mb" }));

  // Ties every ledger command issued while handling this request to a
  // stable, retry-safe ID (idempotency.ts) — the client-supplied
  // Idempotency-Key header if present, otherwise a per-request ID with no
  // cross-retry benefit but no regression either. Must run before any route
  // that might call canton.ts's exerciseChoice/createContract.
  app.use(idempotencyMiddleware);

  // Route-level HTTP metrics for GET /metrics below. Uses req.route's
  // pattern (e.g. "/api/contracts/:id"), not the raw URL, so a metric series
  // doesn't fork per contract ID — recorded on the response "finish" event
  // rather than synchronously, since req.route is only populated once Express
  // has matched a route.
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const route = req.route ? `${req.baseUrl}${req.route.path}` : req.path;
      const labels = { method: req.method, route, status_code: String(res.statusCode) };
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      httpRequestDuration.observe(labels, seconds);
      httpRequestsTotal.inc(labels);
    });
    next();
  });

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Dependency-aware readiness check (audit finding C-2): /health is a bare
  // liveness probe (process is running); this actually confirms the two
  // Postgres pools this backend depends on are reachable. Deliberately
  // doesn't check the Canton ledger itself — canton.ts has no pool/connection
  // to probe (each call is a fresh HTTP request), and a ledger outage should
  // surface as 502s from the routes that actually touch it, not as this
  // process reporting itself globally unready.
  app.get("/ready", async (_req, res) => {
    const checks: Record<string, "ok" | "unreachable" | "skipped (ledger-read mode)"> = {};
    const probes: Promise<void>[] = [appPool.query("SELECT 1").then(() => { checks.appDb = "ok"; })];
    // Ledger-read mode (READS_VIA_LEDGER=1, devnet): PQS-Postgres is not a
    // dependency at all — probing it would report unready over a service the
    // running configuration never touches.
    if (readsViaLedger()) {
      checks.pqsDb = "skipped (ledger-read mode)";
    } else {
      probes.push(pqsPool.query("SELECT 1").then(() => { checks.pqsDb = "ok"; }));
    }
    const results = await Promise.allSettled(probes);
    if (results[0].status === "rejected") checks.appDb = "unreachable";
    if (!readsViaLedger() && results[1].status === "rejected") checks.pqsDb = "unreachable";
    const ready = Object.values(checks).every((v) => v !== "unreachable");
    res.status(ready ? 200 : 503).json({ ready, checks });
  });

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", registry.contentType);
    res.send(await registry.metrics());
  });

  // G1 (docs/platform-review-2026-07.md): the entire operational API requires a
  // valid human session. The router-level requireAuth() here covers every GET
  // (read visibility needs *a* session, any role); each mutating route
  // additionally carries its own requireAuth("<role>") inside the route files,
  // mapping the acting Canton party to the session role that may drive it
  // (business role→business party, financialInstitution→financer, vetify/verifier/
  // dual-controller→vetify). Excluded: /health, /api/auth (login itself), and
  // /api/webhooks (external caller — has its own shared-secret check, and the
  // Underwriting Agent polls its GET without a human session).

  // Stages 1–4: Onboarding → Verification → Compliance → Approved Business
  app.use("/api/onboarding", requireAuth(), onboardingRoutes);

  // Stages 5–7: Financing Request → Underwriting → FI Approval
  app.use("/api/financing", requireAuth(), financingRoutes);

  // Stages 8–10: Murabahah Contract → Repayments → Closure + Portfolio Reports
  app.use("/api/contracts", requireAuth(), contractRoutes);

  // Cross-cutting: scoring-policy propose/approve/reject + PolicyApprover registry
  app.use("/api/policy", requireAuth(), policyRoutes);

  // Stage 0: Financing Provider onboarding + AuthorizedOfficer registry (gates ApproveFunding)
  app.use("/api/providers", requireAuth(), providerRoutes);

  // Layer 3 of the Policy-Approval Security Roadmap: human login, session tokens
  app.use("/api/auth", authRoutes);

  // Inbound third-party webhooks (mono.co creditworthiness — see webhooks.ts)
  app.use("/api/webhooks", webhookRoutes);

  // KYC/onboarding document uploads (local-disk storage — see documents.ts)
  app.use("/api/documents", requireAuth(), documentRoutes);

  // In-app notification feed (poller-fed — see notifications.ts)
  app.use("/api/notifications", requireAuth(), notificationRoutes);

  // Dev-only Stage 2/3 simulation tool (routes/dev.ts) — bypasses real
  // evidence-gathering entirely, so this router is never even mounted
  // outside a non-production NODE_ENV. Never relax this gate.
  if (process.env.NODE_ENV !== "production") {
    app.use("/api/dev", requireAuth(), devRoutes);
  }

  // Single-service hosting (hackathon deploy): serve the built frontend from
  // this same process when frontend/dist exists, so one Render/Fly/etc. web
  // service covers both — no second static-site deployment, no cross-origin
  // config, since the SPA's axios client defaults to a same-origin relative
  // `/api` base URL. No-op locally where the frontend runs via its own Vite
  // dev server instead. Registered after every /api/* route so an unmatched
  // API path still 404s through errorHandler rather than serving index.html.
  const frontendDist = path.resolve(import.meta.dirname, "../../frontend/dist");
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
