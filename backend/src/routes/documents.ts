/**
 * Real (if minimal) local-disk document storage for KYC/onboarding uploads.
 *
 * Closes a gap found live: BusinessOnboarding.Approve hard-requires at least
 * one DocumentRef (Onboarding.daml's Gap 5 assertion), but neither the
 * Business Onboarding form nor the Provider registration form ever had an
 * upload step — every real submission carried documents: [] and could never
 * be approved. DocumentRef.storageRef is documented as a real reference
 * ("e.g. s3://vetify-docs/<cacRegNumber>/cac-cert.pdf") — no cloud object
 * storage account exists in this environment, so this writes to local disk
 * under uploads/ (git-ignored) instead. contentHash is computed server-side
 * from the actual received bytes, not trusted from the client, so it's a
 * genuine SHA-256 of what's stored — not a fabricated placeholder like the
 * pre-existing governingDocRef stopgap in ProviderSettings.tsx.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { requireAuth } from "../auth.js";

const router = Router();
const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a scanned ID/certificate PDF
// Mirrors documents.ts's own upload-time category split (business -> "onboarding",
// everyone else -> "providers") — a fixed allowlist, not the requested ref's own
// text, so a malformed/malicious ref can't be used to probe outside uploads/.
const ALLOWED_CATEGORIES = new Set(["onboarding", "providers"]);

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base.slice(-100) : "document";
}

router.post("/upload", requireAuth(), async (req, res, next) => {
  try {
    const { filename, mimeType, docType, base64Content } = req.body as {
      filename?: string;
      mimeType?: string;
      docType?: string;
      base64Content?: string;
    };
    if (!filename || !docType || !base64Content) {
      return res.status(400).json({ error: "filename, docType and base64Content are required" });
    }
    const buffer = Buffer.from(base64Content, "base64");
    if (buffer.length === 0) {
      return res.status(400).json({ error: "Uploaded file is empty" });
    }
    if (buffer.length > MAX_FILE_BYTES) {
      return res.status(413).json({ error: `File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit` });
    }

    const contentHash = createHash("sha256").update(buffer).digest("hex");
    // Scoped by role rather than a client-supplied category — the same
    // upload endpoint is shared by the business onboarding form and (later)
    // the FI provider registration form.
    const category = req.authUser!.partyRole === "business" ? "onboarding" : "providers";
    const dir = path.join(UPLOAD_ROOT, category);
    await mkdir(dir, { recursive: true });
    const storedName = `${randomUUID()}-${sanitizeFilename(filename)}`;
    await writeFile(path.join(dir, storedName), buffer);

    res.status(201).json({
      docType,
      contentHash,
      storageRef: `local://${category}/${storedName}`,
      mimeType: mimeType ?? null,
      fileSize: buffer.length,
      checksumAlgorithm: "sha256",
    });
  } catch (e) { next(e); }
});

// Serves a previously-uploaded file's actual bytes back — closes the other
// half of the gap this file's header describes: DocumentRef.storageRef was
// being written but nothing ever read it back. Staff-only (vetify/verifier
// review KYC evidence; a business's own upload flow never needs to re-fetch
// its own file, and other roles have no legitimate reason to see another
// business's KYC documents — see CLAUDE.md's privacy model).
router.get("/download", requireAuth(), async (req, res, next) => {
  try {
    const { partyRole } = req.authUser!;
    if (partyRole !== "vetify" && partyRole !== "verifier") {
      return res.status(403).json({ error: "This action requires vetify or verifier staff access" });
    }

    const ref = req.query.ref;
    if (typeof ref !== "string" || !ref.startsWith("local://")) {
      return res.status(400).json({ error: "A valid ref query parameter is required" });
    }

    const withoutScheme = ref.slice("local://".length);
    const slashIx = withoutScheme.indexOf("/");
    if (slashIx === -1) {
      return res.status(400).json({ error: "Malformed ref" });
    }
    const category = withoutScheme.slice(0, slashIx);
    // path.basename strips any directory components a crafted ref might
    // smuggle in; combined with the category allowlist and the resolved-path
    // containment check below, this is defense in depth against traversal
    // even though storageRef is server-generated (documents.ts's own upload
    // route above), not client-authored, in the only path that writes it today.
    const filename = path.basename(withoutScheme.slice(slashIx + 1));
    if (!ALLOWED_CATEGORIES.has(category) || filename === "" || filename === "." || filename === "..") {
      return res.status(400).json({ error: "Malformed ref" });
    }

    const resolved = path.resolve(UPLOAD_ROOT, category, filename);
    if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) {
      return res.status(400).json({ error: "Malformed ref" });
    }

    try {
      await stat(resolved);
    } catch {
      return res.status(404).json({ error: "Document not found" });
    }

    // mimeType/downloadName come from the DocumentRef payload the caller
    // already has (from the ledger, via PQS) — the file on disk carries no
    // metadata of its own, so this is the only source of the original
    // filename/content-type. Not trusted for anything beyond display: the
    // bytes served are always exactly what's on disk at `resolved`.
    const mimeType = typeof req.query.mimeType === "string" ? req.query.mimeType : "application/octet-stream";
    const downloadName = typeof req.query.filename === "string" ? sanitizeFilename(req.query.filename) : filename;

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${downloadName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.sendFile(resolved);
  } catch (e) { next(e); }
});

export default router;
