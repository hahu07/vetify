const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-DiwSGmNR.js","assets/index-BQq4RvRC.css"])))=>i.map(i=>d[i]);
import { r as reactExports, j as jsxRuntimeExports, z as cn, Z as useActor, n as useQuery, D as useQueryClient, E as useMutation, _ as __vitePreload, ad as createActor } from "./index-DiwSGmNR.js";
function scoreColor(score) {
  if (score >= 70) return "oklch(0.55 0.18 145)";
  if (score >= 40) return "oklch(0.7 0.15 85)";
  return "oklch(0.55 0.22 25)";
}
function scoreLabel(score) {
  if (score >= 70) return "High Match";
  if (score >= 40) return "Moderate";
  return "Low Match";
}
function KashifCompatibilityGauge({
  score,
  size = 120,
  strokeWidth = 10,
  showLabel = true,
  className,
  static: isStatic = false
}) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const [displayed, setDisplayed] = reactExports.useState(isStatic ? clampedScore : 0);
  const rafRef = reactExports.useRef(null);
  const prefersReduced = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
  reactExports.useEffect(() => {
    if (isStatic || prefersReduced) {
      setDisplayed(clampedScore);
      return;
    }
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayed(Math.round(eased * clampedScore));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [clampedScore, isStatic, prefersReduced]);
  const radius = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arcAngle = 270;
  const startAngle = 135;
  const sweep = displayed / 100 * arcAngle;
  function polarToCartesian(angle) {
    const rad = (angle - 90) * Math.PI / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad)
    };
  }
  function describeArc(start, end) {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return [
      `M ${s.x.toFixed(2)} ${s.y.toFixed(2)}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
    ].join(" ");
  }
  const trackPath = describeArc(startAngle, startAngle + arcAngle);
  const fillPath = sweep > 0 ? describeArc(startAngle, startAngle + sweep) : "";
  const color = scoreColor(clampedScore);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: cn("flex flex-col items-center gap-1", className),
      role: "meter",
      "aria-label": `Kashif compatibility score: ${clampedScore} out of 100`,
      "aria-valuenow": clampedScore,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "svg",
          {
            width: size,
            height: size,
            viewBox: `0 0 ${size} ${size}`,
            "aria-hidden": "true",
            className: "animate-in fade-in duration-500",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "path",
                {
                  d: trackPath,
                  fill: "none",
                  strokeWidth,
                  stroke: "currentColor",
                  className: "text-muted/30",
                  strokeLinecap: "round"
                }
              ),
              fillPath && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "path",
                {
                  d: fillPath,
                  fill: "none",
                  strokeWidth,
                  stroke: color,
                  strokeLinecap: "round",
                  style: { transition: "stroke 0.3s ease" }
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "text",
                {
                  x: cx,
                  y: cy - 6,
                  textAnchor: "middle",
                  dominantBaseline: "middle",
                  fontSize: size * 0.22,
                  fontWeight: 700,
                  fill: color,
                  style: { fontFamily: "var(--font-display, serif)" },
                  children: displayed
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "text",
                {
                  x: cx,
                  y: cy + size * 0.14,
                  textAnchor: "middle",
                  dominantBaseline: "middle",
                  fontSize: size * 0.1,
                  fill: "currentColor",
                  className: "fill-muted-foreground",
                  children: "/ 100"
                }
              )
            ]
          }
        ),
        showLabel && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-0.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              className: "text-xs font-semibold uppercase tracking-wider",
              style: { color },
              children: scoreLabel(clampedScore)
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] font-medium text-muted-foreground", children: "Kashif (الكاشف)" })
        ] })
      ]
    }
  );
}
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
        const { Principal: Principal2 } = await import("./index-DiwSGmNR.js").then((n) => n.bl);
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
        const { Principal: Principal2 } = await import("./index-DiwSGmNR.js").then((n) => n.bl);
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
        const { Principal: Principal2 } = await import("./index-DiwSGmNR.js").then((n) => n.bl);
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
        const { Principal: Principal2 } = await import("./index-DiwSGmNR.js").then((n) => n.bl);
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
export {
  KashifCompatibilityGauge as K,
  useComparisonData as a,
  useMatchedBorrowers as b,
  useDealReport as c,
  useShortlist as u
};
