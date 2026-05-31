import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface KashifCompatibilityGaugeProps {
  score: number; // 0–100
  size?: number; // SVG dimension in px (default 120)
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
  /** If true, skip the mount animation (e.g. in a list where reduced motion applies) */
  static?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 70) return "oklch(0.55 0.18 145)";
  if (score >= 40) return "oklch(0.7 0.15 85)";
  return "oklch(0.55 0.22 25)";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "High Match";
  if (score >= 40) return "Moderate";
  return "Low Match";
}

/** SVG circular gauge that animates from 0 → score on mount. */
export function KashifCompatibilityGauge({
  score,
  size = 120,
  strokeWidth = 10,
  showLabel = true,
  className,
  static: isStatic = false,
}: KashifCompatibilityGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const [displayed, setDisplayed] = useState(isStatic ? clampedScore : 0);
  const rafRef = useRef<number | null>(null);

  // Respect prefers-reduced-motion
  const prefersReduced =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  useEffect(() => {
    if (isStatic || prefersReduced) {
      setDisplayed(clampedScore);
      return;
    }
    const duration = 900; // ms
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
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
  // Arc spans 270° (from 135° to 405°) — bottom gap at the bottom
  const arcAngle = 270;
  const startAngle = 135; // degrees
  const sweep = (displayed / 100) * arcAngle;

  function polarToCartesian(angle: number): { x: number; y: number } {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function describeArc(start: number, end: number): string {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return [
      `M ${s.x.toFixed(2)} ${s.y.toFixed(2)}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`,
    ].join(" ");
  }

  const trackPath = describeArc(startAngle, startAngle + arcAngle);
  const fillPath = sweep > 0 ? describeArc(startAngle, startAngle + sweep) : "";

  const color = scoreColor(clampedScore);

  return (
    <div
      className={cn("flex flex-col items-center gap-1", className)}
      role="meter"
      aria-label={`Kashif compatibility score: ${clampedScore} out of 100`}
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="animate-in fade-in duration-500"
      >
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          className="text-muted/30"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            strokeWidth={strokeWidth}
            stroke={color}
            strokeLinecap="round"
            style={{ transition: "stroke 0.3s ease" }}
          />
        )}
        {/* Center text */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.22}
          fontWeight={700}
          fill={color}
          style={{ fontFamily: "var(--font-display, serif)" }}
        >
          {displayed}
        </text>
        <text
          x={cx}
          y={cy + size * 0.14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.1}
          fill="currentColor"
          className="fill-muted-foreground"
        >
          / 100
        </text>
      </svg>

      {showLabel && (
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color }}
          >
            {scoreLabel(clampedScore)}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground">
            Kashif (الكاشف)
          </span>
        </div>
      )}
    </div>
  );
}
