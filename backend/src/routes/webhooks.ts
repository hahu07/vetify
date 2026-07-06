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
 */
import { Router } from "express";
import { recordCreditworthinessWebhook, getCreditworthinessWebhook } from "../appdb.js";

const router = Router();

function extractField(body: Record<string, unknown>, ...paths: string[]): unknown {
  const data = (body.data as Record<string, unknown> | undefined) ?? body;
  for (const path of paths) {
    if (data[path] != null) return data[path];
    if (body[path] != null) return body[path];
  }
  return undefined;
}

router.post("/mono/creditworthiness", async (req, res, next) => {
  try {
    const secret = process.env.MONO_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers["mono-webhook-secret"];
      if (provided !== secret) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    }

    const body = req.body as Record<string, unknown>;
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
