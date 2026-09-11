import { sdk } from "@/lib/sdk";
import { formatBps, formatHash, formatRisk, formatToken } from "@/lib/format";

// Session log at request time: never prerender.
export const dynamic = "force-dynamic";

function timeLabel(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default async function HistoryPage() {
  const [strategy] = await sdk.listStrategies();
  const rows = strategy ? await sdk.getHistory(strategy.hash) : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h2 className="text-[24px] font-normal tracking-[-0.012em] text-paper">
          History
        </h2>
        <p className="mt-1 text-[13px] text-fog">
          Swaps against the active strategy.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-[12px] bg-carbon px-4 py-8 text-[14px] text-fog shadow-[var(--shadow-subtle)]">
          No swaps yet. Run a swap to see it here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[12px] bg-carbon shadow-[var(--shadow-subtle)]">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-graphite text-[12px] text-fog">
              <tr>
                <th className="px-4 py-2 font-normal">Tx</th>
                <th className="px-4 py-2 font-normal">When</th>
                <th className="px-4 py-2 font-normal">In</th>
                <th className="px-4 py-2 font-normal">Out</th>
                <th className="px-4 py-2 font-normal">Fee</th>
                <th className="px-4 py-2 font-normal">Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.hash}
                  className="border-b border-graphite last:border-b-0"
                >
                  <td className="px-4 py-2.5 font-mono text-[12px] text-mist">
                    {formatHash(row.hash)}
                  </td>
                  <td className="px-4 py-2.5 text-fog">
                    {timeLabel(row.timestamp)}
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular text-mist">
                    {formatToken(row.amountIn, row.tokenIn)}
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular text-mist">
                    {formatToken(row.amountOut, row.tokenOut)}
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular text-fog">
                    {formatBps(row.feeBps)}
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular text-fog">
                    {formatRisk(row.riskBeforeBps)} → {formatRisk(row.riskAfterBps)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
