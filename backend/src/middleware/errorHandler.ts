/**
 * Central error handler (review gap G16, docs/platform-review-2026-07.md).
 *
 * Previously every failure — including Daml business-rule rejections and
 * Canton infrastructure errors — was flattened to HTTP 500 with the raw
 * internal message echoed to the client (leaking contract IDs, party IDs,
 * and trace IDs). Now:
 * - LedgerError (canton.ts) carries its own HTTP status and a client-safe
 *   publicMessage: 4xx for domain rejections (Daml assertion text, which is
 *   user-facing by design), 502 for ledger infrastructure failures.
 * - Everything else is a genuine 500 with a generic body; the full detail is
 *   logged server-side with a correlation ID the client can quote back.
 *
 * The correlation ID is req.id, generated once per request by pino-http in
 * app.ts (audit finding C-2) — previously this handler minted its own fresh
 * randomUUID() here, a second, disconnected ID from whatever request-scoped
 * logging existed. Reusing req.id means every structured log line for a
 * request and the ID a client can quote back in a support ticket are the
 * same value.
 */
import { Request, Response, NextFunction } from "express";
import { LedgerError } from "../canton.js";

/** express.json()'s underlying body-parser throws a SyntaxError with these
 * fields on malformed JSON — a client mistake, not a server failure. Found
 * live-testing the policy/advisor registration flow (8 Jul 2026): this used
 * to fall into the generic 500 branch below, misclassifying every bad
 * request body as "Internal server error" instead of the 400 it actually is. */
function isBodyParseError(err: unknown): err is SyntaxError & { status: number; type: string } {
  return err instanceof SyntaxError && "status" in err && (err as { status: unknown }).status === 400
    && "type" in err && (err as { type: unknown }).type === "entity.parse.failed";
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof LedgerError) {
    // Internal detail (trace IDs, contract IDs) stays in the server log only.
    req.log?.error({ code: err.code, err }, `Ledger error: ${err.code}`);
    return res.status(err.status).json({ error: err.publicMessage, code: err.code });
  }

  const correlationId = req.id != null ? String(req.id) : "unknown";

  if (isBodyParseError(err)) {
    req.log?.warn({ correlationId, err: err.message }, "Malformed JSON request body");
    return res.status(400).json({ error: "Malformed JSON in request body", correlationId });
  }

  req.log?.error({ correlationId, err }, "Unhandled API error");
  res.status(500).json({ error: "Internal server error", correlationId });
}
