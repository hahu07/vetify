/**
 * Inbound webhooks from third-party providers.
 *
 * mono.co Creditworthiness: assess_creditworthiness's result is delivered via
 * webhook, not returned synchronously from the initiating API call (confirmed
 * from mono-server.ts's own tool description). This receiver persists the
 * result keyed by mono.co's `reference`; the Underwriting Agent
 * (agents/src/agents/underwriting.ts) polls GET /:reference for a bounded
 * window after triggering the check, and treats DSCR as unavailable — not
 * fabricated — if nothing arrives in time.
 *
 * Honesty note: this codebase has no independently verified schema for
 * mono.co's real webhook payload (see agents/skills/underwriting/references/
 * mono-underwriting-fields.md). The field-name guesses below
 * (data.dscr/dscr, data.credit_score/creditScore/credit_score,
 * data.reference/reference) are best-effort, not verified against a live
 * mono.co webhook delivery — the full raw payload is always persisted
 * regardless, so nothing is lost even if a guess is wrong.
 *
 * Hardening (audit findings M-5, Phase 3 Enterprise Production Readiness
 * Audit, 2026-07-08):
 *  1. An unset MONO_WEBHOOK_SECRET used to skip verification entirely —
 *     any caller could POST arbitrary DSCR/credit-score data straight into
 *     Stage 6 underwriting evidence. Now fails closed unless running in a
 *     recognized local/test environment, mirroring config.ts's session-
 *     secret posture.
 *  2. mono.co's actual scheme here is a static shared-secret header, not an
 *     HMAC signature over a timestamped body — there is no verified
 *     timestamp/nonce field in the payload to check freshness against (see
 *     the honesty note above), so a textbook signed-timestamp replay check
 *     isn't something this endpoint can honestly implement. What it *can*
 *     do without trusting an unverified field: reject an exact-duplicate
 *     raw payload seen again within a short window — a real defense against
 *     a captured request being blindly replayed, independent of whatever
 *     mono.co's payload does or doesn't contain. This is in-process only
 *     (resets on restart, doesn't span multiple instances) — adequate for
 *     this platform's current single-instance deployment, not a substitute
 *     for a real signed-payload scheme if mono.co ever offers one.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { recordCreditworthinessWebhook, getCreditworthinessWebhook } from "../appdb.js";
import { readSecret } from "../secrets.js";
import { isRecognizedDevEnvironment } from "../config.js";
import { logger } from "../logger.js";

const router = Router();

const REPLAY_WINDOW_MS = parseInt(process.env.WEBHOOK_REPLAY_WINDOW_MS ?? "300000", 10); // 5 minutes
const seenPayloads = new Map<string, number>(); // sha256(raw body) -> expiry

function hashPayload(raw: unknown): string {
  return createHash("sha256").update(JSON.stringify(raw)).digest("hex");
}

/** Returns true (and records it) the first time this exact payload is seen
 * within the replay window; false on a repeat. */
function isFreshDelivery(raw: unknown): boolean {
  const now = Date.now();
  for (const [hash, expiry] of seenPayloads) {
    if (expiry <= now) seenPayloads.delete(hash);
  }
  const hash = hashPayload(raw);
  if (seenPayloads.has(hash)) return false;
  seenPayloads.set(hash, now + REPLAY_WINDOW_MS);
  return true;
}

function extractField(body: Record<string, unknown>, ...paths: string[]): unknown {
  const data = (body.data as Record<string, unknown> | undefined) ?? body;
  for (const path of paths) {
    if (data[path] != null) return data[path];
    if (body[path] != null) return body[path];
  }
  return undefined;
}

/** Constant-time secret comparison (review gap G17): a plain `!==` leaks how
 * many leading characters matched through response timing. Hashing both sides
 * first also equalizes lengths, which timingSafeEqual requires. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

router.post("/mono/creditworthiness", async (req, res, next) => {
  try {
    const secret = readSecret("MONO_WEBHOOK_SECRET");
    if (!secret) {
      if (!isRecognizedDevEnvironment()) {
        return res.status(503).json({ error: "Webhook receiver is not configured" });
      }
      logger.warn("MONO_WEBHOOK_SECRET is unset — accepting an unverified webhook (allowed only because NODE_ENV is a recognized dev/test environment)");
    } else {
      const provided = req.headers["mono-webhook-secret"];
      if (typeof provided !== "string" || !secretsMatch(provided, secret)) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    }

    const body = req.body as Record<string, unknown>;
    if (!isFreshDelivery(body)) {
      return res.status(409).json({ error: "Duplicate webhook delivery ignored" });
    }
    const reference = extractField(body, "reference", "request_id", "id");
    if (typeof reference !== "string" || reference === "") {
      return res.status(400).json({ error: "Webhook payload missing a reference/request_id" });
    }
    const dscrRaw = extractField(body, "dscr");
    const creditScoreRaw = extractField(body, "credit_score", "creditScore");

    await recordCreditworthinessWebhook({
      reference,
      dscr: dscrRaw != null ? Number(dscrRaw) : null,
      creditScore: creditScoreRaw != null ? Number(creditScoreRaw) : null,
      rawPayload: body,
    });

    res.status(200).json({ received: true });
  } catch (e) { next(e); }
});

// Polled by agents/src/agents/underwriting.ts — 404 while the webhook hasn't
// arrived yet (not an error; the agent's poll loop treats this as "not yet").
router.get("/mono/creditworthiness/:reference", async (req, res, next) => {
  try {
    const result = await getCreditworthinessWebhook(req.params.reference);
    if (!result || result.dscr === null) {
      return res.status(404).json({ error: "Not received yet" });
    }
    res.json({ dscr: result.dscr, creditScore: result.creditScore ?? undefined });
  } catch (e) { next(e); }
});

export default router;
