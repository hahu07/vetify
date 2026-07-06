/**
 * Human authentication — Layer 3 (login/session) and Layer 4 (TOTP MFA) of
 * the Policy-Approval Security Roadmap. See auth.ts's module doc comment for
 * the distinction between this session token and the Canton party JWTs in
 * canton.ts.
 */
import { Router } from "express";
import QRCode from "qrcode";
import {
  authenticate, issueSessionToken, issueMfaPendingToken, verifyMfaPendingToken,
  generateTotpSecret, totpKeyUri, verifyTotpCode, requireAuth,
} from "../auth.js";
import { listAuditLog, findUserById, setTotpSecret, setTotpEnabled } from "../appdb.js";

const router = Router();

// Step 1 of login: verify password. If the account has Layer 4 MFA enabled,
// this does NOT issue a real session — only a short-lived mfaToken that is
// only good for completing /mfa/verify-login, nothing else (see auth.ts's
// requireAuth, which rejects any token whose `type` isn't "session").
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    const user = await authenticate(username, password);
    if (user.totpEnabled) {
      return res.json({ mfaRequired: true, mfaToken: issueMfaPendingToken(user) });
    }
    res.json({ token: issueSessionToken(user), displayName: user.displayName, partyRole: user.partyRole });
  } catch {
    res.status(401).json({ error: "Invalid username or password" });
  }
});

// Step 2 of login, only reached when the account has MFA enabled.
router.post("/mfa/verify-login", async (req, res, next) => {
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
router.get("/audit-log", requireAuth(), async (_req, res, next) => {
  try {
    res.json(await listAuditLog());
  } catch (e) { next(e); }
});

export default router;
