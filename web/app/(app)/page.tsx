import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskMeter } from "@/components/risk-meter";
import { sdk } from "@/lib/sdk";
import { formatBps, formatHash, formatRisk, formatUsd } from "@/lib/format";

// Onchain reads at request time: never prerender without a local node.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [strategy] = await sdk.listStrategies();
  if (!strategy) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <p className="text-[14px] text-fog">No strategy shipped yet.</p>
        <Button variant="primary" size="md" asChild className="mt-4">
          <Link href="/strategy">Create strategy</Link>
        </Button>
      </div>
    );
  }

  const stats = [
    { label: "Total value", value: formatUsd(strategy.capitalUsd) },
    {
      label: "Allocation",
      value: `${strategy.tokenA.symbol} ${Math.round(strategy.allocationA * 100)}%  ${strategy.tokenB.symbol} ${Math.round(strategy.allocationB * 100)}%`,
    },
    {
      label: "Fee",
      value: formatBps(strategy.currentFeeBps),
    },
    {
      label: "Maximum trade",
      value: formatUsd(strategy.maxTradeUsd),
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <section className="flex flex-col gap-1">
        <p className="font-mono text-[12px] tracking-[-0.013em] text-fog">
          {formatHash(strategy.hash)}
        </p>
        <h2 className="text-[24px] font-normal leading-[1.33] tracking-[-0.012em] text-paper">
          {strategy.tokenA.symbol} / {strategy.tokenB.symbol}
        </h2>
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] bg-graphite md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-carbon px-4 py-4">
            <p className="text-[12px] text-fog">{stat.label}</p>
            <p className="mt-1 font-mono text-[14px] tabular tracking-[-0.013em] text-paper">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col gap-5">
          <RiskMeter
            currentBps={strategy.currentRiskBps}
            maxBps={strategy.maxRiskBps}
          />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-fog">{strategy.tokenA.symbol}</span>
              <span className="font-mono tabular text-mist">
                {Math.round(strategy.allocationA * 100)}%
              </span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-[2px] bg-graphite">
              <span
                className="bg-mist"
                style={{ width: `${strategy.allocationA * 100}%` }}
              />
              <span
                className="bg-smoke"
                style={{ width: `${strategy.allocationB * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-fog">{strategy.tokenB.symbol}</span>
              <span className="font-mono tabular text-mist">
                {Math.round(strategy.allocationB * 100)}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-fog">Next action</p>
            <p className="text-[15px] leading-[1.6] text-mist">
              Risk is {formatRisk(strategy.currentRiskBps)} of a{" "}
              {formatRisk(strategy.maxRiskBps)} limit. Projected risk on swap is
              informational; the onchain limit still reverts if exceeded.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="md" asChild>
              <Link href="/swap">Swap</Link>
            </Button>
            <Button variant="ghost" size="md" asChild>
              <Link href="/strategy">Edit strategy</Link>
            </Button>
          </div>
        </Card>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] text-fog">Strategies</h3>
          <Badge>Active</Badge>
        </div>
        <Link
          href="/strategy"
          className="flex items-center justify-between gap-3 rounded-[12px] bg-carbon px-4 py-3 shadow-[var(--shadow-subtle)] transition-colors duration-150 hover:bg-obsidian"
        >
          <div className="min-w-0">
            <p className="text-[14px] text-paper">
              {strategy.tokenA.symbol} / {strategy.tokenB.symbol}
            </p>
            <p className="font-mono text-[12px] text-fog">
              {formatHash(strategy.hash)}
            </p>
          </div>
          <div className="flex items-center gap-4 text-right">
            <span className="font-mono text-[13px] tabular text-mist">
              {formatUsd(strategy.capitalUsd)}
            </span>
            <span className="font-mono text-[12px] tabular text-fog">
              {formatRisk(strategy.currentRiskBps)}
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}
