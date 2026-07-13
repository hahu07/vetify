/**
 * Idempotent command IDs — a gap surfaced by comparing this backend against
 * Canton's own app-dev guidance (docs.canton.network/appdev/modules/
 * m4-backend-dev), 8 Jul 2026: "the Ledger API deduplicates commands by
 * this ID, which prevents double-submission if your backend retries a
 * command that actually succeeded" — but only if the *same* command ID is
 * presented on the retry. Previously, canton.ts's nextCommandId() minted a
 * fresh ID on every call regardless of whether the inbound HTTP request was
 * itself a retry (a proxy/gateway replaying a timed-out request, or any
 * future client-side retry logic), so Canton's own deduplication never
 * actually had anything to recognize.
 *
 * This ties a request-scoped identifier — the client-supplied
 * Idempotency-Key header, generated once per distinct frontend action in
 * api/client.ts's request interceptor and preserved verbatim if that exact
 * request is ever replayed — to every ledger command issued while handling
 * that request, via AsyncLocalStorage. canton.ts's exerciseChoice/
 * createContract don't need any signature change, and no route file needs
 * to thread a parameter through by hand: a repeat of the same HTTP request
 * produces the same sequence of ledger command IDs, so Canton's own
 * deduplication window does the rest.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Request, Response, NextFunction } from "express";

interface IdempotencyContext {
  key: string;
  callIndex: number;
}

const als = new AsyncLocalStorage<IdempotencyContext>();

export function idempotencyMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers["idempotency-key"];
  const key = typeof header === "string" && header.length > 0 ? header : randomUUID();
  als.run({ key, callIndex: 0 }, next);
}

/**
 * A stable per-call command ID when called inside a request handled by
 * idempotencyMiddleware, composed so N ledger calls within one logical
 * request produce the same N command IDs on a genuine retry of that exact
 * request (same key, same call order). Returns null outside any request
 * context (e.g. a script invoked directly, not through Express) so callers
 * can fall back to a non-idempotent ID.
 */
export function requestScopedCommandId(prefix: string): string | null {
  const ctx = als.getStore();
  if (!ctx) return null;
  const id = `${prefix}-${ctx.key}-${ctx.callIndex}`;
  ctx.callIndex += 1;
  return id;
}
