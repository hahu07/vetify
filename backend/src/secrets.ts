/**
 * Secret resolution (review gap G2, docs/platform-review-2026-07.md).
 *
 * Every secret can now be supplied as a FILE PATH via the `<NAME>_FILE`
 * convention (Docker secrets / Kubernetes mounted-secret style) instead of an
 * inline environment variable — the first step away from "every credential
 * lives in one plaintext .env". Precedence: `<NAME>_FILE` (file contents,
 * trimmed) wins over `<NAME>`; neither set → empty string, preserving the
 * existing per-call failure behaviour (partyId() throws, jwt header omitted).
 *
 * Custody split guidance — which secrets must NOT be co-located in
 * production — lives in docs/secrets-custody.md.
 */
import { readFileSync } from "node:fs";

export function readSecret(name: string): string {
  const filePath = process.env[`${name}_FILE`];
  if (filePath) {
    try {
      return readFileSync(filePath, "utf8").trim();
    } catch (err) {
      throw new Error(`${name}_FILE is set to "${filePath}" but the file is unreadable: ${err instanceof Error ? err.message : err}`);
    }
  }
  return process.env[name] ?? "";
}
