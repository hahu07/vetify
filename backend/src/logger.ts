/**
 * Structured logging (audit finding C-2, Phase 3 Enterprise Production
 * Readiness Audit, 2026-07-08): the backend previously logged only via plain
 * console.*, with no levels, no structure, and nothing an aggregator could
 * parse. This doesn't stand up Prometheus/Grafana or a log-shipping pipeline
 * — that needs real infrastructure this repo doesn't have (see
 * docs/phase2-tranche-b-design.md) — but it makes every log line structured
 * JSON on stdout, level-controlled via LOG_LEVEL, and (via pino-http in
 * app.ts) carries a per-request ID through every line tied to that request.
 * Any log shipper (Fluent Bit, Promtail, a cloud provider's agent) can pick
 * this up directly; that's the point of writing JSON lines rather than
 * inventing a bespoke format.
 */
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "vetify-backend" },
  // pino-http (app.ts) logs the full request/response, headers included by
  // default — without this, every request line would put that request's
  // live 12h-TTL session JWT and the webhook shared secret in plaintext into
  // whatever log storage this ends up shipped to. Redacted, not just
  // omitted from a serializer, so it can't be reintroduced by an unrelated
  // future change to req serialization.
  redact: {
    paths: [
      "req.headers.authorization",
      'req.headers["mono-webhook-secret"]',
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
});
