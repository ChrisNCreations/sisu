import { cn } from "@/lib/utils";
import { formatRisk } from "@/lib/format";

interface RiskMeterProps {
  currentBps: number;
  projectedBps?: number;
  maxBps: number;
  className?: string;
}

// Distance-from-equilibrium gauge. The track runs from balanced (left)
// to the onchain limit (right edge marker). Current risk is a paper tick
// that is never overpainted; the projected fill answers each quote.
// Coral red is reserved as the sole over-limit signal (Q2a).
export function RiskMeter({
  currentBps,
  projectedBps,
  maxBps,
  className,
}: RiskMeterProps) {
  const projected = projectedBps ?? currentBps;
  const over = projected > maxBps;
  const scale = Math.max(maxBps, projected, 1);
  const pct = (value: number) =>
    Math.min(100, Math.max(0, (value / scale) * 100));
  const limitPct = pct(maxBps);
  const midPct = pct(maxBps / 2);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-fog">Risk</span>
        <span className="font-mono text-[13px] tabular text-mist">
          <span className={over ? "text-coral-red" : "text-paper"}>
            {formatRisk(projected)}
          </span>
          <span className="text-fog"> / {formatRisk(maxBps)}</span>
        </span>
      </div>
      <div
        className="relative h-1.5 rounded-[2px] bg-graphite"
        role="meter"
        aria-label="Strategy risk"
        aria-valuemin={0}
        aria-valuemax={maxBps}
        aria-valuenow={projected}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-[2px] transition-[width] duration-300 ease-[var(--ease-out)]"
          style={{
            width: `${pct(projected)}%`,
            background: over ? "var(--color-coral-red)" : "var(--color-acid-lime)",
          }}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-[10px] w-px -translate-y-1/2 bg-ash"
          style={{ left: `${midPct}%` }}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-[10px] w-[2px] -translate-y-1/2 bg-paper"
          style={{ left: `calc(${pct(currentBps)}% - 1px)` }}
        />
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 h-[10px] w-px -translate-y-1/2",
            over ? "bg-coral-red" : "bg-fog",
          )}
          style={{ left: `calc(${limitPct}% - 1px)` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-3 text-[11px] text-fog">
        <span>balanced</span>
        <span>limit</span>
      </div>
    </div>
  );
}
