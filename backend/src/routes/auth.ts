/**
 * Human authentication — Layer 3 (login/session) and Layer 4 (TOTP MFA) of
 * the Policy-Approval Security Roadmap. See auth.ts's module doc comment for
 * the distinction between this session token and the Canton party JWTs in
 * canton.ts.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import QRCode from "qrcode";
import {
  authenticate, issueSessionToken, issueMfaPendingToken, verifyMfaPendingToken,
  generateTotpSecret, totpKeyUri, verifyTotpCode, hashPassword, requireAuth, AccountLockedError,
} from "../auth.js";
import { listAuditLog, findUserById, findUserByUsername, createUser, setTotpSecret, setTotpEnabled } from "../appdb.js";
import { allocateParty, registerDynamicParty, fiPartyKey } from "../canton.js";

const router = Router();

// Audit finding M-2 (Phase 3 Enterprise Production Readiness Audit,
// 2026-07-08): neither the password step nor the TOTP step had any
// per-IP throttle, leaving unlimited credential-stuffing / TOTP-brute-force
// attempts against accounts that can approve policy changes and Shari'a
// certifications. IP-based limiting below is the first line of defense —
// it does not by itself stop a distributed attack rotating source IPs
// against a single username, which is what the persistent per-account
// lockout in auth.ts's authenticate() (AccountLockedError, caught below)
// closes as the follow-up.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts from this address — try again later." },
});

const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification attempts from this address — try again later." },
});

// Layer 4 was deliberately opt-in per user, which leaves an un-enrolled
// governance account at Layer 3's security level indefinitely (documented in
// docs/deferred-gaps.md's deployment notes). ENFORCE_GOVERNANCE_MFA=1 closes
// that for production (review gap G17): users whose partyRole is in the
// governance set below cannot obtain a session without TOTP enabled.
// NOTE the operational sequencing this implies: enrollment itself requires a
// session (/mfa/enroll-init is requireAuth-gated), so governance users must
// enroll BEFORE this flag is switched on — it's a ratchet you enable once
// onboarding is complete, not a self-service gate. Default off for dev.
const GOVERNANCE_ROLES = new Set(["vetify", "riskCommittee"]);
const enforceGovernanceMfa = process.env.ENFORCE_GOVERNANCE_MFA === "1";

// Step 1 of login: verify password. If the account has Layer 4 MFA enabled,
// this does NOT issue a real session — only a short-lived mfaToken that is
// only good for completing /mfa/verify-login, nothing else (see auth.ts's
// requireAuth, which rejects any token whose `type` isn't "session").
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    const user = await authenticate(username, password);
    if (user.totpEnabled) {
      return res.json({ mfaRequired: true, mfaToken: issueMfaPendingToken(user) });
    }
    if (enforceGovernanceMfa && GOVERNANCE_ROLES.has(user.partyRole)) {
      return res.status(403).json({
        error: "MFA is required for governance accounts on this deployment. Enrollment must be completed before enforcement was enabled — contact your administrator.",
        mfaEnrollmentRequired: true,
      });
    }
    res.json({ token: issueSessionToken(user), displayName: user.displayName, partyRole: user.partyRole });
  } catch (err) {
    if (err instanceof AccountLockedError) {
      const retryAfterSeconds = Math.max(0, Math.ceil((err.lockedUntil.getTime() - Date.now()) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(423).json({
        error: `Too many failed login attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
        lockedUntil: err.lockedUntil.toISOString(),
      });
    }
    res.status(401).json({ error: "Invalid username or password" });
  }
});

// Self-serve account creation — Business signups act through the existing
// shared "business" Canton party (scoped later by their own CAC registration
// number, once they submit their BusinessOnboarding — see onboarding.ts).
// Financer signups get a brand-new Canton party allocated right here, since
// FinancingProviderOnboarding's ledger key (financialInstitution, vetify)
// only allows ONE draft to exist under a single shared FI party — every
// financer genuinely needs its own party for multi-FI signup to work at all.
const SELF_SERVE_ROLES = new Set(["business", "financer"]);

router.post("/signup", loginLimiter, async (req, res, next) => {
  try {
    const { username, password, displayName, role } = req.body;
    if (!username || !password || !displayName || !SELF_SERVE_ROLES.has(role)) {
      return res.status(400).json({
        error: "username, password, displayName and role ('business' or 'financer') are required",
      });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const normalizedUsername = String(username).toLowerCase().trim();
    if (await findUserByUsername(normalizedUsername)) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Allocate the Canton party BEFORE inserting the user row — a failed
    // allocation must never leave an orphaned financer account with no
    // resolvable party.
    let cantonPartyId: string | null = null;
    if (role === "financer") {
      const hint = `FI-${normalizedUsername.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || "signup"}-${Date.now()}`;
      cantonPartyId = await allocateParty(hint);
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await createUser({
        username: normalizedUsername,
        passwordHash,
        displayName,
        partyRole: role,
        cantonPartyId,
        cantonPartyJwt: cantonPartyId ? "" : null,
      });
    } catch (err) {
      // Race condition on the username UNIQUE constraint (the findUserByUsername
      // check above isn't atomic with this insert).
      if (err instanceof Error && /duplicate key value/i.test(err.message)) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }
      throw err;
    }

    if (cantonPartyId) registerDynamicParty(fiPartyKey(user.id), cantonPartyId, "");

    res.status(201).json({ token: issueSessionToken(user), displayName: user.displayName, partyRole: user.partyRole });
  } catch (err) {
    next(err);
  }
});

// Step 2 of login, only reached when the account has MFA enabled.
router.post("/mfa/verify-login", mfaLimiter, async (req, res, next) => {
  try {
    const { mfaToken, code } = req.body;
    const { userId } = verifyMfaPendingToken(mfaToken);
    const user = await findUserById(userId);
    if (!user || !user.active || !user.totpEnabled || !user.totpSecret) {
      return res.status(401).json({ error: "MFA is not enabled for this account" });
    }
    if (!verifyTotpCode(user.totpSecret, code)) {
      return res.status(401).json({ error: "Invalid or expired code" });
    }
    res.json({ token: issueSessionToken(user), displayName: user.displayName, partyRole: user.partyRole });
  } catch {
    res.status(401).json({ error: "Invalid or expired MFA session — please log in again" });
  }
});

// Begin MFA enrollment — requires an already-authenticated (password-only)
// session. Stores the secret immediately but does NOT enable MFA yet; login
// stays password-only until /mfa/enroll-verify proves the user can actually
// generate a valid code, so there's no partial-lockout risk from an
// abandoned setup.
router.post("/mfa/enroll-init", requireAuth(), async (req, res, next) => {
  try {
    const { userId, username } = req.authUser!;
    const secret = generateTotpSecret();
    await setTotpSecret(userId, secret);
    const uri = totpKeyUri(secret, username);
    const qrCodeDataUrl = await QRCode.toDataURL(uri);
    res.json({ secret, otpauthUri: uri, qrCodeDataUrl });
  } catch (e) { next(e); }
});

router.post("/mfa/enroll-verify", requireAuth(), async (req, res, next) => {
  try {
    const { userId } = req.authUser!;
    const { code } = req.body;
    const user = await findUserById(userId);
    if (!user?.totpSecret) {
      return res.status(400).json({ error: "No MFA enrollment in progress — call /mfa/enroll-init first" });
    }
    if (!verifyTotpCode(user.totpSecret, code)) {
      return res.status(401).json({ error: "Invalid code" });
    }
    await setTotpEnabled(userId, true);
    res.json({ enabled: true });
  } catch (e) { next(e); }
});

router.post("/mfa/disable", requireAuth(), async (req, res, next) => {
  try {
    await setTotpEnabled(req.authUser!.userId, false);
    res.json({ enabled: false });
  } catch (e) { next(e); }
});

// The actual Layer 3 deliverable: who (authenticated individual) did what,
// independent of which shared Canton party the ledger itself saw.
//
// Audit finding M-4 (Phase 3 Enterprise Production Readiness Audit,
// 2026-07-08): this previously accepted any authenticated session of any
// role. Because listAuditLog() is deliberately cross-party (that's the
// point — it's the one place individual attribution survives regardless of
// which shared Canton party a governance action rode in on), an
// unrestricted GET let a business or FI session read vetify/riskCommittee
// staff activity, defeating the party-privacy boundary Canton itself
// enforces everywhere else. Reusing GOVERNANCE_ROLES here rather than a
// second literal list: the audit log's intended readers are exactly the
// governance-side roles the Layer 4 MFA ratchet above already singles out.
router.get("/audit-log", requireAuth(), async (req, res, next) => {
  try {
    if (!GOVERNANCE_ROLES.has(req.authUser!.partyRole)) {
      return res.status(403).json({ error: "Audit log access requires a vetify or riskCommittee session" });
    }
    res.json(await listAuditLog());
  } catch (e) { next(e); }
});

export default router;
