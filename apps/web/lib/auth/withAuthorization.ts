import type { PartyRole, SessionContext } from "@/lib/db";
import { AuthorizationError } from "@/lib/errors";

/**
 * Mitigation for addendum D's gap #1 ("authorization is no longer
 * compile-checked"): a Daml `controller X` clause makes it a build error to
 * exercise a choice without X's signature. Plain TypeScript has no such
 * backstop, so every domain function that used to be a Daml choice MUST be
 * defined through this wrapper rather than calling its logic directly — that
 * turns "remember to check the role" back into a structural property (one
 * missed check anywhere is now impossible instead of silently exploitable),
 * mirroring what the compiler enforced before.
 */
export function withAuthorization<Args extends unknown[], R>(
  allowedRoles: PartyRole[],
  fn: (session: SessionContext, ...args: Args) => Promise<R>,
) {
  return async (session: SessionContext, ...args: Args): Promise<R> => {
    if (!allowedRoles.includes(session.partyRole)) {
      throw new AuthorizationError(
        `Role '${session.partyRole}' is not authorized for this action; requires one of [${allowedRoles.join(", ")}]`,
      );
    }
    return fn(session, ...args);
  };
}
