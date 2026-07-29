import { cookies } from "next/headers";
import type { SessionContext } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/** Reads and verifies the httpOnly session cookie for a Route Handler. */
export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}
