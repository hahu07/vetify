import { createActor } from "@/backend";
import type {
  CompatibilityResult,
  DealReport,
  KashifReportLog,
  ShortlistEntry,
} from "@/types/kashif";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// useMatchedBorrowers
// ---------------------------------------------------------------------------

export function useMatchedBorrowers(page = 1, pageSize = 20) {
  const { actor, isFetching } = useActor(createActor);

  return useQuery<{ items: CompatibilityResult[]; total: bigint }>({
    queryKey: ["kashif", "matched_borrowers", page, pageSize],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0n };
      const result = await actor.getMatchedBorrowers(
        BigInt(page - 1),
        BigInt(pageSize),
      );
      return {
        items: result.items as CompatibilityResult[],
        total: result.total,
      };
    },
    enabled: !!actor && !isFetching,
    placeholderData: (prev) => prev,
  });
}

// ---------------------------------------------------------------------------
// useDealReport
// ---------------------------------------------------------------------------

export function useDealReport(businessId: string | null) {
  const { actor, isFetching } = useActor(createActor);

  return useQuery<DealReport | null>({
    queryKey: ["kashif", "deal_report", businessId],
    queryFn: async () => {
      if (!actor || !businessId) return null;
      const { Principal } = await import("@icp-sdk/core/principal");
      const result = await actor.getDealReport(Principal.fromText(businessId));
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok as DealReport;
    },
    enabled: !!actor && !isFetching && !!businessId,
    retry: 2,
  });
}

// ---------------------------------------------------------------------------
// useShortlist
// ---------------------------------------------------------------------------

export function useShortlist() {
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();

  const shortlistQuery = useQuery<ShortlistEntry[]>({
    queryKey: ["kashif", "shortlist"],
    queryFn: async () => {
      if (!actor) return [];
      const entries = await actor.getShortlist();
      return entries as ShortlistEntry[];
    },
    enabled: !!actor && !isFetching,
  });

  const addMutation = useMutation({
    mutationFn: async (businessId: string) => {
      if (!actor) throw new Error("Actor not ready");
      const { Principal } = await import("@icp-sdk/core/principal");
      const result = await actor.shortlistBorrower(
        Principal.fromText(businessId),
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kashif", "shortlist"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (businessId: string) => {
      if (!actor) throw new Error("Actor not ready");
      const { Principal } = await import("@icp-sdk/core/principal");
      const result = await actor.removeFromShortlist(
        Principal.fromText(businessId),
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kashif", "shortlist"] });
    },
  });

  const shortlistedIds = new Set(
    (shortlistQuery.data ?? []).map((e) => e.businessId.toString()),
  );

  return {
    shortlist: shortlistQuery.data ?? [],
    isLoading: shortlistQuery.isLoading,
    isError: shortlistQuery.isError,
    shortlistedIds,
    addToShortlist: (id: string) => addMutation.mutate(id),
    removeFromShortlist: (id: string) => removeMutation.mutate(id),
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}

// ---------------------------------------------------------------------------
// useComparisonData
// ---------------------------------------------------------------------------

export function useComparisonData(businessIds: string[]) {
  const { actor, isFetching } = useActor(createActor);
  // Cap at 4 IDs per backend contract
  const capped = businessIds.slice(0, 4);

  return useQuery<CompatibilityResult[]>({
    queryKey: ["kashif", "comparison", capped],
    queryFn: async () => {
      if (!actor || capped.length === 0) return [];
      const { Principal } = await import("@icp-sdk/core/principal");
      const principals = capped.map((id) => Principal.fromText(id));
      const result = await actor.getComparisonData(principals);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok as CompatibilityResult[];
    },
    enabled: !!actor && !isFetching && capped.length > 0,
  });
}

// ---------------------------------------------------------------------------
// useKashifLogs (admin)
// ---------------------------------------------------------------------------

export function useKashifLogs(page = 1, pageSize = 20) {
  const { actor, isFetching } = useActor(createActor);

  return useQuery<{ items: KashifReportLog[]; total: bigint }>({
    queryKey: ["kashif", "logs", page, pageSize],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0n };
      const result = await actor.adminGetKashifLogs(
        BigInt(page - 1),
        BigInt(pageSize),
      );
      return {
        items: result.items as KashifReportLog[],
        total: result.total,
      };
    },
    enabled: !!actor && !isFetching,
  });
}

// ---------------------------------------------------------------------------
// useRegenerateReport (admin)
// ---------------------------------------------------------------------------

interface RegenerateOptions {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

export function useRegenerateReport(opts?: RegenerateOptions) {
  const { actor } = useActor(createActor);

  return useMutation({
    mutationFn: async (businessId: string) => {
      if (!actor) throw new Error("Actor not ready");
      const { Principal } = await import("@icp-sdk/core/principal");
      const result = await actor.adminTriggerReportRegeneration(
        Principal.fromText(businessId),
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: opts?.onSuccess,
    onError: opts?.onError,
  });
}
