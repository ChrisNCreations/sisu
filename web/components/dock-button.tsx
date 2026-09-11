"use client";

import { useState } from "react";
import { useWalletClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/providers";
import { appendHistory, sdk } from "@/lib/sdk";
import { explorerTxUrl, getDeployment, publicClient } from "@/lib/chain";
import { formatAddress } from "@/lib/format";

interface DockButtonProps {
  strategyHash: `0x${string}`;
}

/** Maker-only close control. Renders nothing for non-makers. */
export function DockButton({ strategyHash }: DockButtonProps) {
  const { address, connect } = useWallet();
  const { data: walletClient } = useWalletClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const deployment = getDeployment();
  const isMaker =
    !!address &&
    !!deployment &&
    address.toLowerCase() === deployment.maker.toLowerCase();
  if (!isMaker) return null;

  async function onDock() {
    if (!address) {
      connect();
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    if (!walletClient) return;
    setBusy(true);
    setStatus(null);
    try {
      const tx = await sdk.dockStrategy({ strategyHash });
      const hash = await walletClient.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setLastTx(hash);
      setStatus("Strategy docked. It no longer fills.");
      setConfirming(false);
      appendHistory({
        hash,
        timestamp: Date.now(),
        action: "dock",
        success: true,
        tokenIn: "",
        tokenOut: "",
        amountIn: 0,
        amountOut: 0,
        feeBps: 0,
        riskBeforeBps: 0,
        riskAfterBps: 0,
        direction: "AtoB",
      });
    } catch (err) {
      setStatus(
        err instanceof Error ? `Dock failed: ${err.message}` : "Dock failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const explorer = lastTx ? explorerTxUrl(lastTx) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant="ghost"
        size="md"
        disabled={busy || !walletClient}
        onClick={onDock}
        className="text-coral-red"
      >
        {busy ? "Docking" : confirming ? "Confirm dock" : "Dock strategy"}
      </Button>
      {confirming && !busy && (
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[12px] text-fog hover:text-mist"
        >
          Keep strategy ({formatAddress(address ?? "")})
        </button>
      )}
      {status && (
        <p className="text-[12px] text-fog" role="status">
          {status}{" "}
          {explorer && (
            <a
              href={explorer}
              target="_blank"
              rel="noreferrer"
              className="font-mono tabular text-mist underline decoration-white/20 underline-offset-2"
            >
              View on explorer
            </a>
          )}
        </p>
      )}
    </div>
  );
}
