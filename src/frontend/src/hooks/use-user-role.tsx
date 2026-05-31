import type { BusinessProfile, FinancierProfile } from "@/backend";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useBackend } from "./use-backend";

/**
 * All possible resolved roles in the application.
 * `null` means authentication state is still loading.
 */
export type AppUserRole =
  | "business"
  | "financier"
  | "admin"
  | "individual"
  | "unregistered"
  | null;

export type UserRoleProfile =
  | { role: "business"; profile: BusinessProfile }
  | { role: "financier"; profile: FinancierProfile }
  | { role: "admin"; profile: null }
  | { role: "individual"; profile: null }
  | { role: "unregistered"; profile: null };

export function useUserRole() {
  const { actor, isFetching } = useBackend();
  const { isAuthenticated } = useAuth();

  const query = useQuery<UserRoleProfile>({
    queryKey: ["userRole"],
    queryFn: async (): Promise<UserRoleProfile> => {
      if (!actor) return { role: "unregistered", profile: null };

      const isAdmin = await actor.isCallerAdmin();
      if (isAdmin) return { role: "admin", profile: null };

      const [businessProfile, financierProfile] = await Promise.all([
        actor.getMyBusinessProfile(),
        actor.getMyFinancierProfile(),
      ]);

      if (businessProfile) {
        return { role: "business", profile: businessProfile };
      }
      if (financierProfile) {
        return { role: "financier", profile: financierProfile };
      }

      // Check for individual profile last to keep existing role priority intact
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const individualProfile = await (
          actor as unknown as Record<
            string,
            (...args: unknown[]) => Promise<unknown>
          >
        ).getMyIndividualProfile?.();
        if (individualProfile) {
          return { role: "individual", profile: null };
        }
      } catch {
        // Backend may not yet have this method during development; fail gracefully
      }

      return { role: "unregistered", profile: null };
    },
    enabled: !!actor && !isFetching && isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const roleData = query.data;

  return {
    role: roleData?.role ?? (isAuthenticated ? null : "unregistered"),
    profile: roleData?.profile ?? null,
    isLoading: query.isLoading || isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
