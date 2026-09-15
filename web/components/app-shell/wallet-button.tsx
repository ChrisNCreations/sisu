"use client";

import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/providers";
import { formatAddress } from "@/lib/format";

export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();

  if (!address) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={connect}
        disabled={connecting}
        className="h-8 px-4 text-[13px] font-[510]"
      >
        {connecting ? "Connecting" : "Connect"}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={disconnect}
      className="font-mono text-[12px] tracking-[-0.013em]"
      title="Disconnect"
    >
      {formatAddress(address)}
    </Button>
  );
}
