/**
 * Human authentication — Layer 3 of the Policy-Approval Security Roadmap.
 *
 * Deliberately a separate token/secret from the Canton party JWTs in
 * canton.ts: those authorize *that* this backend may act as a given Canton
 * party (vetify, riskCommittee, ...) — one shared credential per party. This
 * session token authenticates *which individual human* is currently using
 * this backend, independent of which shared party credential eventually
 * submits their action to the ledger.
 */
import "dotenv/config";
import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import { findUserByUsername, GovernanceUser } from "./appdb.js";

const SESSION_SECRET = process.env.SESSION_JWT_SECRET ?? "dev-only-insecure-secret-change-me";
const SESSION_TTL = "12h";
const MFA_PENDING_TTL = "5m";

export interface SessionPayload {
  type: "session";
  userId: number;
  username: string;
  displayName: string;
  partyRole: string;
}

// Layer 4: issued after password verifies but before a required TOTP code is
// checked — deliberately cannot satisfy requireAuth (see the `type` check
// below), so a stolen/leaked pending token grants nothing on its own.
export interface MfaPendingPayload {
  type: "mfa_pending";
  userId: number;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function issueSessionToken(user: GovernanceUser): string {
  const payload: SessionPayload = {
    type: "session",
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    partyRole: user.partyRole,
  };
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: SESSION_TTL });
}

export function issueMfaPendingToken(user: GovernanceUser): string {
  const payload: MfaPendingPayload = { type: "mfa_pending", userId: user.id };
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: MFA_PENDING_TTL });
}

export function verifyMfaPendingToken(token: string): MfaPendingPayload {
  const payload = jwt.verify(token, SESSION_SECRET) as MfaPendingPayload;
  if (payload.type !== "mfa_pending") {
    throw new Error("Not a valid MFA-pending token");
  }
  return payload;
}

// Layer 4: TOTP (RFC 6238) — the software/app-based MFA half of "hardware-
// backed keys + MFA". WebAuthn/FIDO2 hardware keys specifically were not
// built in this pass (see docs/deferred-gaps.md for why).
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpKeyUri(secret: string, username: string): string {
  return authenticator.keyuri(username, "Vetify Governance", secret);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: SessionPayload;
    }
  }
}

/** Requires a valid *fully authenticated* session token (not an MFA-pending
 * one); optionally requires a specific partyRole. */
export function requireAuth(partyRole?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing session token" });
    }
    try {
      const payload = jwt.verify(header.slice(7), SESSION_SECRET) as SessionPayload;
      if (payload.type !== "session") {
        return res.status(401).json({ error: "Invalid session token" });
      }
      if (partyRole && payload.partyRole !== partyRole) {
        return res.status(403).json({ error: `This action requires a ${partyRole} session` });
      }
      req.authUser = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired session token" });
    }
  };
}

export async function authenticate(username: string, password: string): Promise<GovernanceUser> {
  const user = await findUserByUsername(username);
  if (!user || !user.active) {
    throw new Error("Invalid username or password");
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid username or password");
  }
  return user;
}
