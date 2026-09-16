"use client";

// Route-group error boundary. Server components doing onchain reads
// (Dashboard / Swap / Strategy) throw when the Hardhat node is down or
// unreachable; Next renders this instead of an unstyled 500.
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16 md:px-6">
      <p className="font-mono text-[12px] tracking-[-0.013em] text-coral-red">
        RPC_UNREACHABLE
      </p>
      <h2 className="text-[24px] font-normal leading-[1.33] tracking-[-0.012em] text-paper">
        Local node is not responding
      </h2>
      <p className="text-[15px] leading-[1.6] text-mist">
        This page reads strategy state onchain at request time. Start the
        Hardhat node and reseed, then retry.
      </p>
      <pre className="w-full overflow-x-auto rounded-[6px] border border-graphite bg-carbon px-3 py-2.5 font-mono text-[12px] leading-[1.6] text-fog">
        {`npx hardhat node
npm run seed:local`}
      </pre>
      {error.digest ? (
        <p className="font-mono text-[11px] text-ash">
          digest {error.digest}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="primary" size="md" onClick={reset}>
          Retry
        </Button>
        <Button variant="ghost" size="md" onClick={() => location.assign("/")}>
          Dashboard
        </Button>
      </div>
    </div>
  );
}
