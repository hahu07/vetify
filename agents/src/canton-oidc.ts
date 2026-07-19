/**
 * OIDC client-credentials auth for a real, authenticated Canton participant
 * (e.g. a Canton Network devnet validator) — an alternative to the static
 * per-party `CANTON_*_JWT` model canton-client.ts otherwise uses for the
 * unauthenticated local `dpm sandbox`. Mirrors backend/src/canton-oidc.ts
 * exactly (same devnet, same token endpoint) — kept as a separate copy rather
 * than a shared package since agents/ and backend/ are independent npm
 * projects with no existing shared-code mechanism between them.
 *
 * One shared machine identity acts as every party (actAs carries the specific
 * party per request regardless of which token authorized the call).
 *
 * Enabled by setting CANTON_OIDC_CLIENT_ID/CANTON_OIDC_CLIENT_SECRET — when
 * unset, canton-client.ts falls back to the legacy static-JWT-per-party flow.
 */
import { readSecret } from "./secrets.js";

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cache: TokenCache | null = null;
let inFlight: Promise<string> | null = null;

// Refresh ahead of actual expiry so an in-flight ledger request never races a
// token that expires mid-call. fivenorth's devnet issues 8h tokens (confirmed
// live via its token endpoint's expires_in); 5 minutes of slack is generous
// relative to that and cheap relative to how rarely this path runs.
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export function isOidcAuthConfigured(): boolean {
  return Boolean(readSecret("CANTON_OIDC_CLIENT_ID") && readSecret("CANTON_OIDC_CLIENT_SECRET"));
}

async function fetchToken(): Promise<TokenCache> {
  const tokenUrl = process.env.CANTON_OIDC_TOKEN_URL;
  const clientId = readSecret("CANTON_OIDC_CLIENT_ID");
  const clientSecret = readSecret("CANTON_OIDC_CLIENT_SECRET");
  const audience = process.env.CANTON_OIDC_AUDIENCE;
  const scope = process.env.CANTON_OIDC_SCOPE;
  if (!tokenUrl) throw new Error("CANTON_OIDC_TOKEN_URL is not set");

  const form = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
  if (audience) form.set("audience", audience);
  if (scope) form.set("scope", scope);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OIDC token exchange failed [${res.status}]: ${text}`);

  let data: { access_token?: string; expires_in?: number };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`OIDC token endpoint returned non-JSON response: ${text}`);
  }
  if (!data.access_token) throw new Error(`OIDC token endpoint returned no access_token: ${text}`);

  const ttlMs = (data.expires_in ?? 3600) * 1000;
  return { accessToken: data.access_token, expiresAt: Date.now() + ttlMs };
}

/** Returns a cached token if it still has more than REFRESH_BUFFER_MS of life
 * left, otherwise fetches a fresh one. Concurrent callers during a refresh
 * share the same in-flight request rather than each firing their own. */
export async function getOidcAccessToken(): Promise<string> {
  if (cache && cache.expiresAt - REFRESH_BUFFER_MS > Date.now()) {
    return cache.accessToken;
  }
  if (!inFlight) {
    inFlight = fetchToken()
      .then((tok) => {
        cache = tok;
        return tok.accessToken;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
