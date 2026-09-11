"use client";

import { useCallback, useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import { encodeFunctionData, type Hex } from "viem";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/providers";
import { erc20Abi, publicClient, readAllowance } from "@/lib/chain";

interface ApproveButtonProps {
  token: Hex;
  spender: Hex;
  needed: bigint;
  symbol: string;
  onApproved?: () => void;
}

/** Allowance gate: shows an Approve button until `needed` is covered. */
export function ApproveButton({
  token,
  spender,
  needed,
  symbol,
  onApproved,
}: ApproveButtonProps) {
  const { address } = useWallet();
  const { data: walletClient } = useWalletClient();
  const [allowed, setAllowed] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      setAllowed(null);
      return;
    }
    try {
      setAllowed(await readAllowance(token, address as Hex, spender));
    } catch {
      setAllowed(null);
    }
  }, [address, token, spender]);

  useEffect(() => {
    refresh();
  }, [refresh, needed]);

  if (!address || allowed === null) return null;
  if (needed <= 0n || allowed >= needed) return null;

  async function onApprove() {
    if (!walletClient) return;
    setBusy(true);
    try {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, (1n << 256n) - 1n],
      });
      const hash = await walletClient.sendTransaction({
        to: token,
        data,
        value: BigInt(0),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
      onApproved?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="subtle"
      size="md"
      className="w-full"
      disabled={busy || !walletClient}
      onClick={onApprove}
    >
      {busy ? `Approving ${symbol}` : `Approve ${symbol}`}
    </Button>
  );
}
