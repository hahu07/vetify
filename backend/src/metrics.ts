/**
 * Prometheus-format metrics (audit finding C-2, Phase 3 Enterprise
 * Production Readiness Audit, 2026-07-08). GET /metrics exposes this in the
 * plain-text exposition format any Prometheus-compatible scraper expects —
 * there is no Prometheus server or Grafana dashboard deployed anywhere in
 * this project yet (that's real infrastructure, out of scope for a code
 * change), but the application now emits what one would scrape.
 *
 * Deliberately unauthenticated, same posture as /health: standard Prometheus
 * practice is to keep the scrape endpoint network-isolated to trusted
 * scrapers (a cluster-internal ClusterIP, a firewall rule) rather than
 * app-level auth, since a scraper is infrastructure, not a user. Whoever
 * deploys this for real needs to make sure /metrics isn't reachable from the
 * public internet — this file can't enforce that from inside the process.
 */
import { Registry, collectDefaultMetrics, Histogram, Counter } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [registry],
});
