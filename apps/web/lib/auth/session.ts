import jwt from "jsonwebtoken";
import type { PartyRole, SessionContext } from "@/lib/db";

const SECRET = process.env.SESSION_JWT_SECRET ?? "dev-only-insecure-secret";
export const SESSION_COOKIE = "vetify_web_session";

export interface SessionTokenPayload {
  userId: number;
  username: string;
  displayName: string;
  partyRole: PartyRole;
  cacRegNumber: string | null;
}

export function signSession(payload: SessionTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "8h" });
}

export function verifySession(token: string): SessionContext | null {
  try {
    const decoded = jwt.verify(token, SECRET) as SessionTokenPayload;
    return {
      userId: decoded.userId,
      username: decoded.username,
      displayName: decoded.displayName,
      partyRole: decoded.partyRole,
      cacRegNumber: decoded.cacRegNumber,
    };
  } catch {
    return null;
  }
}
