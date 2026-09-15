import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskMeter } from "@/components/risk-meter";
import { DockButton } from "@/components/dock-button";
import { sdk } from "@/lib/sdk";
import {
  formatAddress,
  formatBps,
  formatHash,
  formatRisk,
  formatToken,
  formatUsd,
} from "@/lib/format";

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

  const balances = await sdk.getBalances(strategy.hash);

  const drift = strategy.allocationA - strategy.allocationB;
  const thinSide =
    drift > 0.01
      ? strategy.tokenB.symbol
      : drift < -0.01
        ? strategy.tokenA.symbol
        : null;

  // Dollars speak in the text face (human stakes); hashes, bps, and
  // percents stay mono (machine artifacts).
  const stats = [
    {
      label: "Total value",
      value: formatUsd(strategy.capitalUsd),
      mono: false,
    },
    {
      label: "Fee",
      value: formatBps(strategy.currentFeeBps),
      mono: true,
    },
    {
      label: "Maximum trade",
      value: formatUsd(strategy.maxTradeUsd),
      mono: false,
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[12px] tracking-[-0.013em] text-fog">
            {formatHash(strategy.hash)}
          </p>
          <h2 className="text-[24px] font-normal leading-[1.33] tracking-[-0.012em] text-paper">
            {strategy.tokenA.symbol} / {strategy.tokenB.symbol}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge>Active</Badge>
          <DockButton strategyHash={strategy.hash} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] bg-graphite md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-carbon px-4 py-4">
            <p className="text-[12px] text-fog">{stat.label}</p>
            <p
              className={
                stat.mono
                  ? "mt-1 font-mono text-[14px] tabular tracking-[-0.013em] text-paper"
                  : "mt-1 text-[14px] font-[510] tracking-[-0.013em] text-paper"
              }
            >
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
              {formatRisk(strategy.maxRiskBps)} limit.{" "}
              {thinSide
                ? `Fund the ${thinSide} side to pull the book back toward 50/50.`
                : "Book is balanced."}{" "}
              Projected risk on swap is informational; the onchain limit still
              reverts if exceeded.
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

      <Card className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] text-fog">
            Virtual vs maker wallet
          </h3>
          <span className="font-mono text-[12px] tabular text-fog">
            {formatAddress(balances.maker)}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px] md:grid-cols-4">
          <div>
            <dt className="text-fog">Virtual {strategy.tokenA.symbol}</dt>
            <dd className="mt-1 font-mono text-[14px] tabular text-paper">
              {formatToken(balances.virtualA, "")}
            </dd>
            <dd className="text-[12px] text-fog">
              {formatUsd(balances.virtualUsdA)}
            </dd>
          </div>
          <div>
            <dt className="text-fog">Virtual {strategy.tokenB.symbol}</dt>
            <dd className="mt-1 font-mono text-[14px] tabular text-paper">
              {formatToken(balances.virtualB, "")}
            </dd>
            <dd className="text-[12px] text-fog">
              {formatUsd(balances.virtualUsdB)}
            </dd>
          </div>
          <div>
            <dt className="text-fog">Wallet {strategy.tokenA.symbol}</dt>
            <dd className="mt-1 font-mono text-[14px] tabular text-paper">
              {formatToken(balances.walletA, "")}
            </dd>
            <dd className="text-[12px] text-fog">
              {formatUsd(balances.walletUsdA)}
            </dd>
          </div>
          <div>
            <dt className="text-fog">Wallet {strategy.tokenB.symbol}</dt>
            <dd className="mt-1 font-mono text-[14px] tabular text-paper">
              {formatToken(balances.walletB, "")}
            </dd>
            <dd className="text-[12px] text-fog">
              {formatUsd(balances.walletUsdB)}
            </dd>
          </div>
        </dl>
        <p className="text-[12px] text-fog">
          Virtual is what Aqua believes the strategy holds. Wallet is what the
          maker can actually pay — underfunded strategies stop filling.
        </p>
      </Card>

    </div>
  );
}
