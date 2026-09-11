import { sdk } from "@/lib/sdk";
import { formatHash } from "@/lib/format";
import { StrategyForm } from "./strategy-form";

// Onchain reads at request time: never prerender without a local node.
export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const [strategy] = await sdk.listStrategies();

  if (!strategy) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-[14px] text-fog">No strategy available.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-[24px] font-normal tracking-[-0.012em] text-paper">
          Strategy
        </h2>
        <p className="font-mono text-[12px] text-fog">
          {formatHash(strategy.hash)}
        </p>
      </header>
      <StrategyForm strategy={strategy} />
    </div>
  );
}
