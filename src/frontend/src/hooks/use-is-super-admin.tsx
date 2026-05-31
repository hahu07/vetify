import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useBackend } from "./use-backend";

export function useIsSuperAdmin() {
  const { actor, isFetching } = useBackend();
  const { isAuthenticated, principal } = useAuth();

  const query = useQuery<{ isSuperAdmin: boolean }>({
    queryKey: ["isSuperAdmin"],
    queryFn: async (): Promise<{ isSuperAdmin: boolean }> => {
      if (!actor) return { isSuperAdmin: false };

      const isAdmin = await actor.isCallerAdmin();
      if (!isAdmin) return { isSuperAdmin: false };

      // Super-admin is the principal who bootstrapped the canister
      const bootstrapAdmin = await actor.getBootstrapAdmin();
      if (!bootstrapAdmin) return { isSuperAdmin: false };
      return {
        isSuperAdmin: bootstrapAdmin.toString() === principal?.toString(),
      };
    },
    enabled: !!actor && !isFetching && isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  return {
    isSuperAdmin: query.data?.isSuperAdmin ?? false,
    isLoading: query.isLoading || isFetching,
  };
}
