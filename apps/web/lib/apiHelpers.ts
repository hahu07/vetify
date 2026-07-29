import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/requireSession";
import { AuthorizationError, DomainError } from "@/lib/errors";
import type { SessionContext } from "@/lib/db";

/**
 * Wraps a Route Handler body: resolves the session, maps DomainError to 422
 * and AuthorizationError to 403 -- mirroring backend/src/canton.ts's
 * existing toLedgerError() -> 422 convention so error handling on the
 * frontend doesn't need to change shape between the two stacks.
 */
export function withRoute<T>(
  fn: (session: SessionContext, req: Request) => Promise<T>,
) {
  return async (req: Request) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    try {
      const result = await fn(session, req);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof AuthorizationError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      if (err instanceof DomainError) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      console.error(err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
