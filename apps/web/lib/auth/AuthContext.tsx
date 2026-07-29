"use client";

import { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

/**
 * Mirrors frontend/src/auth/AuthContext.tsx's shape (User/UserRole/ROLE_DASHBOARD)
 * closely enough that the ported Layout.tsx needs minimal changes. `verifier`,
 * `assessor`, `sentinel`, and `advisor` all map onto the same 'vetify'
 * UserRole nav bucket the real frontend already uses for its shared "Vetify
 * Staff" portal -- CLAUDE.md frames verifier/assessor/sentinel as "vetify's
 * own team" (advisor is genuinely independent, but still has no separate
 * portal in the real UI either); the distinction is enforced server-side
 * (lib/auth/withAuthorization.ts), not by which nav a human sees.
 * `financialInstitution` gets its own UserRole bucket -- a genuinely separate
 * portal, matching the real frontend's business/financer/vetify split.
 * `regulator` (added for the Reporting slice) gets its own bucket too: a
 * genuinely distinct, read-only supervisory observer, never "vetify's own
 * team" the way verifier/assessor/sentinel are.
 * `riskCommittee` (added for the Nineteenth Slice's policy-governance UI)
 * gets its own bucket too, same reasoning as `regulator` -- CLAUDE.md's own
 * framing is that it's genuinely independent of `vetify`, not "vetify's own
 * team" the way verifier/assessor/sentinel/advisor are (advisor still maps
 * onto the vetify bucket above only because the real frontend never gave it
 * a separate portal either -- that reasoning doesn't apply to riskCommittee,
 * which never had a real-frontend precedent to begin with).
 */
export type UserRole = "business" | "vetify" | "financialInstitution" | "regulator" | "riskCommittee";
export type RealRole = "business" | "vetify" | "verifier" | "assessor" | "financialInstitution" | "advisor" | "sentinel" | "regulator" | "riskCommittee";

export interface User {
  name: string;
  orgName: string;
  role: UserRole;
  realRole: RealRole;
}

export const ROLE_DASHBOARD: Record<UserRole, string> = {
  business: "/business/onboarding",
  vetify: "/vetify/onboarding",
  financialInstitution: "/fi/financing",
  regulator: "/regulator/reports",
  riskCommittee: "/riskcommittee/policies",
};

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface SessionResponse {
  displayName: string;
  partyRole: RealRole;
  cacRegNumber: string | null;
}

const ROLE_ORG: Record<RealRole, string> = {
  business: "Business Portal",
  vetify: "Vetify Platform",
  verifier: "Vetify Platform",
  assessor: "Vetify Platform",
  sentinel: "Vetify Platform",
  advisor: "Vetify Platform",
  financialInstitution: "Financial Institution Portal",
  regulator: "Regulator Portal",
  riskCommittee: "Risk Committee Portal",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await axios.get<SessionResponse>("/api/auth/me");
      return data;
    },
    retry: false,
  });

  const user: User | null = session
    ? {
        name: session.displayName,
        orgName: session.cacRegNumber ?? ROLE_ORG[session.partyRole],
        role:
          session.partyRole === "business"
            ? "business"
            : session.partyRole === "financialInstitution"
              ? "financialInstitution"
              : session.partyRole === "regulator"
                ? "regulator"
                : session.partyRole === "riskCommittee"
                  ? "riskCommittee"
                  : "vetify",
        realRole: session.partyRole,
      }
    : null;

  const logout = useCallback(async () => {
    await axios.post("/api/auth/logout");
    queryClient.clear();
    router.push("/login");
  }, [queryClient, router]);

  return <AuthContext.Provider value={{ user, isLoading, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
