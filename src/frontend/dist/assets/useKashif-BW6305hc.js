const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-CPnZ4-ee.js","assets/index-R6qPL6fG.css"])))=>i.map(i=>d[i]);
import { ac as useActor, n as useQuery, A as useQueryClient, D as useMutation, _ as __vitePreload, ad as createActor } from "./index-CPnZ4-ee.js";
function useMatchedBorrowers(page = 1, pageSize = 20) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["kashif", "matched_borrowers", page, pageSize],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0n };
      const result = await actor.getMatchedBorrowers(
        BigInt(page - 1),
        BigInt(pageSize)
      );
      return {
        items: result.items,
        total: result.total
      };
    },
    enabled: !!actor && !isFetching,
    placeholderData: (prev) => prev
  });
}
function useDealReport(businessId) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["kashif", "deal_report", businessId],
    queryFn: async () => {
      if (!actor || !businessId) return null;
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      const result = await actor.getDealReport(Principal.fromText(businessId));
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    enabled: !!actor && !isFetching && !!businessId,
    retry: 2
  });
}
function useShortlist() {
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();
  const shortlistQuery = useQuery({
    queryKey: ["kashif", "shortlist"],
    queryFn: async () => {
      if (!actor) return [];
      const entries = await actor.getShortlist();
      return entries;
    },
    enabled: !!actor && !isFetching
  });
  const addMutation = useMutation({
    mutationFn: async (businessId) => {
      if (!actor) throw new Error("Actor not ready");
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      const result = await actor.shortlistBorrower(
        Principal.fromText(businessId)
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kashif", "shortlist"] });
    }
  });
  const removeMutation = useMutation({
    mutationFn: async (businessId) => {
      if (!actor) throw new Error("Actor not ready");
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      const result = await actor.removeFromShortlist(
        Principal.fromText(businessId)
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kashif", "shortlist"] });
    }
  });
  const shortlistedIds = new Set(
    (shortlistQuery.data ?? []).map((e) => e.businessId.toString())
  );
  return {
    shortlist: shortlistQuery.data ?? [],
    isLoading: shortlistQuery.isLoading,
    isError: shortlistQuery.isError,
    shortlistedIds,
    addToShortlist: (id) => addMutation.mutate(id),
    removeFromShortlist: (id) => removeMutation.mutate(id),
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending
  };
}
function useComparisonData(businessIds) {
  const { actor, isFetching } = useActor(createActor);
  const capped = businessIds.slice(0, 4);
  return useQuery({
    queryKey: ["kashif", "comparison", capped],
    queryFn: async () => {
      if (!actor || capped.length === 0) return [];
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      const principals = capped.map((id) => Principal.fromText(id));
      const result = await actor.getComparisonData(principals);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    enabled: !!actor && !isFetching && capped.length > 0
  });
}
function useKashifLogs(page = 1, pageSize = 20) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["kashif", "logs", page, pageSize],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0n };
      const result = await actor.adminGetKashifLogs(
        BigInt(page - 1),
        BigInt(pageSize)
      );
      return {
        items: result.items,
        total: result.total
      };
    },
    enabled: !!actor && !isFetching
  });
}
function useRegenerateReport(opts) {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (businessId) => {
      if (!actor) throw new Error("Actor not ready");
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      const result = await actor.adminTriggerReportRegeneration(
        Principal.fromText(businessId)
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: opts == null ? void 0 : opts.onSuccess,
    onError: opts == null ? void 0 : opts.onError
  });
}
export {
  useComparisonData as a,
  useMatchedBorrowers as b,
  useDealReport as c,
  useKashifLogs as d,
  useRegenerateReport as e,
  useShortlist as u
};
