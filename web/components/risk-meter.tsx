import { cn } from "@/lib/utils";
import { formatRisk } from "@/lib/format";

interface RiskMeterProps {
  currentBps: number;
  projectedBps?: number;
  maxBps: number;
  className?: string;
}

export function RiskMeter({
  currentBps,
  projectedBps,
  maxBps,
  className,
}: RiskMeterProps) {
  const currentPct = Math.min(100, (currentBps / maxBps) * 100);
  const projected = projectedBps ?? currentBps;
  const projectedPct = Math.min(100, (projected / maxBps) * 100);
  const over = projected > maxBps;

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
        className="relative h-1 overflow-hidden rounded-[2px] bg-graphite"
        role="meter"
        aria-label="Strategy risk"
        aria-valuemin={0}
        aria-valuemax={maxBps}
        aria-valuenow={projected}
      >
        <span
          className="absolute inset-y-0 left-0 bg-smoke"
          style={{ width: `${currentPct}%` }}
        />
        <span
          className={cn(
            "absolute inset-y-0 left-0",
            over ? "bg-coral-red" : "bg-acid-lime",
          )}
          style={{ width: `${projectedPct}%` }}
        />
      </div>
    </div>
  );
}
