import { sdk } from "@/lib/sdk";
import { SwapTicket } from "./swap-ticket";

// Onchain reads at request time: never prerender without a local node.
export const dynamic = "force-dynamic";

export default async function SwapPage() {
  const [strategy] = await sdk.listStrategies();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
      <div className="text-center">
        <h2 className="text-[20px] font-[590] leading-[1.33] tracking-[-0.012em] text-paper">
          Swap
        </h2>
        <p className="mt-1 text-[13px] text-fog">
          {strategy
            ? `${strategy.tokenA.symbol} / ${strategy.tokenB.symbol}`
            : "No strategy"}
        </p>
      </div>
      {strategy ? (
        <SwapTicket strategy={strategy} />
      ) : (
        <p className="text-center text-[14px] text-fog">
          Ship a strategy before swapping.
        </p>
      )}
    </div>
  );
}
