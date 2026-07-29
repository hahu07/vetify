// Client-side SHA-256 hashing for document uploads -- the same mechanism
// app/business/onboarding/page.tsx already uses inline for KYC documents,
// extracted here so the collateral valuation upload doesn't duplicate it.
// A real hash of the real file bytes; storageRef stays a `local://filename`
// placeholder since this migration has no server-side file storage wired up
// (a pre-existing, already-documented limitation, not new here).

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const MAX_DOCUMENT_BYTES = 1024 * 1024;
