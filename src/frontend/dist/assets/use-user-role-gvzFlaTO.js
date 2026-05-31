import { g as useBackend, u as useAuth, n as useQuery } from "./index-CPnZ4-ee.js";
function useUserRole() {
  const { actor, isFetching } = useBackend();
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: ["userRole"],
    queryFn: async () => {
      var _a;
      if (!actor) return { role: "unregistered", profile: null };
      const isAdmin = await actor.isCallerAdmin();
      if (isAdmin) return { role: "admin", profile: null };
      const [businessProfile, financierProfile] = await Promise.all([
        actor.getMyBusinessProfile(),
        actor.getMyFinancierProfile()
      ]);
      if (businessProfile) {
        return { role: "business", profile: businessProfile };
      }
      if (financierProfile) {
        return { role: "financier", profile: financierProfile };
      }
      try {
        const individualProfile = await ((_a = actor.getMyIndividualProfile) == null ? void 0 : _a.call(actor));
        if (individualProfile) {
          return { role: "individual", profile: null };
        }
      } catch {
      }
      return { role: "unregistered", profile: null };
    },
    enabled: !!actor && !isFetching && isAuthenticated,
    staleTime: 1e3 * 60 * 5
  });
  const roleData = query.data;
  return {
    role: (roleData == null ? void 0 : roleData.role) ?? (isAuthenticated ? null : "unregistered"),
    profile: (roleData == null ? void 0 : roleData.profile) ?? null,
    isLoading: query.isLoading || isFetching,
    isError: query.isError,
    refetch: query.refetch
  };
}
export {
  useUserRole as u
};
