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
import { readSecret } from "./secrets.js";
import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import { findUserByUsername, GovernanceUser, recordFailedLogin, resetFailedLogins } from "./appdb.js";

const SESSION_SECRET = readSecret("SESSION_JWT_SECRET") || "dev-only-insecure-secret-change-me";
const SESSION_TTL = "12h";
const MFA_PENDING_TTL = "5m";

// Persistent per-account lockout (audit finding M-2, Phase 3 Enterprise
// Production Readiness Audit, 2026-07-08): the earlier pass added IP-based
// rate limiting on the login/MFA routes but deliberately deferred this —
// IP throttling alone doesn't stop a distributed attack rotating source IPs
// against one username, which is the actual gap this closes.
const LOCKOUT_THRESHOLD = parseInt(process.env.ACCOUNT_LOCKOUT_THRESHOLD ?? "5", 10);
const LOCKOUT_MINUTES = parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES ?? "15", 10);

export class AccountLockedError extends Error {
  constructor(public lockedUntil: Date) {
    super("Account temporarily locked due to repeated failed login attempts");
    this.name = "AccountLockedError";
  }
}

export interface SessionPayload {
  type: "session";
  userId: number;
  username: string;
  displayName: string;
  partyRole: string;
  // Self-serve signup tenant-scoping keys (migrations/002_signup_isolation.sql).
  // Business: the CAC registration number their BusinessOnboarding was
  // created with — undefined until their first submission. Financer: the
  // Canton party dynamically allocated for them at signup (canton.ts's
  // fiPartyKey(userId) is the registry key that resolves to it) — undefined
  // for the legacy shared-party demo account and for non-financer roles.
  cacRegNumber?: string;
  financialInstitutionPartyId?: string;
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
    ...(user.cacRegNumber ? { cacRegNumber: user.cacRegNumber } : {}),
    ...(user.cantonPartyId ? { financialInstitutionPartyId: user.cantonPartyId } : {}),
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
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw new AccountLockedError(new Date(user.lockedUntil));
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const lockedUntil = await recordFailedLogin(user.id, LOCKOUT_THRESHOLD, LOCKOUT_MINUTES);
    // If *this* failure is the one that crossed the threshold, report the
    // lockout on this same response — live-tested: without this check, the
    // triggering attempt returned a generic "invalid password" and the
    // account only revealed itself as locked on the next attempt, one
    // request later than the client should have been told.
    if (lockedUntil) throw new AccountLockedError(lockedUntil);
    throw new Error("Invalid username or password");
  }
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await resetFailedLogins(user.id);
  }
  return user;
}
