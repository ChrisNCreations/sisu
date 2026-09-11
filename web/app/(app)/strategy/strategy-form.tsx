"use client";

import { useState } from "react";
import { useWalletClient } from "wagmi";
import { parseEther } from "viem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApproveButton } from "@/components/approve-button";
import { useWallet } from "@/components/providers";
import { sdk, appendHistory, type SisuStrategy } from "@/lib/sdk";
import { getDeployment, publicClient } from "@/lib/chain";

function toWei(value: string): bigint | null {
  try {
    const wei = parseEther(value || "0");
    return wei;
  } catch {
    return null;
  }
}

interface FieldDef {
  id: string;
  label: string;
  hint: string;
  value: string;
}

function fieldsFrom(strategy: SisuStrategy): FieldDef[] {
  return [
    {
      id: "depositEth",
      label: "Deposit ETH",
      hint: "Maker deposit, ETH",
      value: "1",
    },
    {
      id: "depositUsdc",
      label: "Deposit USDC",
      hint: "Maker deposit, USDC",
      value: "3000",
    },
    {
      id: "maxRisk",
      label: "Max risk",
      hint: "Percent, e.g. 60 = 60%",
      value: String((strategy.maxRiskBps / 1_000_000_000) * 100),
    },
    {
      id: "baseFee",
      label: "Base fee",
      hint: "bps",
      value: String(strategy.baseFeeBps),
    },
    {
      id: "maxFee",
      label: "Max fee",
      hint: "bps",
      value: String(strategy.maxFeeBps),
    },
    {
      id: "rebalanceStrength",
      label: "Rebalance strength",
      hint: "multiplier",
      value: String(strategy.rebalanceStrength),
    },
  ];
}

export function StrategyForm({ strategy }: { strategy: SisuStrategy }) {
  const { address, connect } = useWallet();
  const { data: walletClient } = useWalletClient();
  const [fields, setFields] = useState(fieldsFrom(strategy));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(id: string, value: string) {
    setFields((current) =>
      current.map((field) => (field.id === id ? { ...field, value } : field)),
    );
  }

  async function onShip(event: React.FormEvent) {
    event.preventDefault();
    if (!address) {
      connect();
      return;
    }
    if (!walletClient) return;
    setBusy(true);
    setStatus(null);
    const get = (id: string) =>
      fields.find((field) => field.id === id)?.value ?? "";
    try {
      const tx = await sdk.shipStrategy({
        tokenA: strategy.tokenA.address,
        tokenB: strategy.tokenB.address,
        capital: 0,
        targetWeight: 0,
        maxRisk: Number(get("maxRisk")),
        baseFee: Number(get("baseFee")),
        maxFee: Number(get("maxFee")),
        rebalanceStrength: Number(get("rebalanceStrength")),
        maxTrade: 0,
        depositEth: Number(get("depositEth")),
        depositUsdc: Number(get("depositUsdc")),
      } as Parameters<typeof sdk.shipStrategy>[0]);
      const hash = await walletClient.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`Strategy shipped: ${hash}`);
      appendHistory({
        hash,
        timestamp: Date.now(),
        action: "ship",
        success: true,
        tokenIn: strategy.tokenA.symbol,
        tokenOut: strategy.tokenB.symbol,
        amountIn: Number(get("depositEth")),
        amountOut: Number(get("depositUsdc")),
        feeBps: 0,
        riskBeforeBps: 0,
        riskAfterBps: 0,
        direction: "AtoB",
      });
    } catch (err) {
      setStatus(
        err instanceof Error ? `Ship failed: ${err.message}` : "Ship failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onShip}>
      <Card className="flex flex-col gap-5 p-5">
        <p className="text-[13px] text-fog">
          Pair locked: {strategy.tokenA.symbol} / {strategy.tokenB.symbol}.
          50/50 policy, no target weight. Max trade is a derived hint, not a
          policy input.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.id} className="flex flex-col gap-1.5">
              <label htmlFor={field.id} className="text-[12px] text-fog">
                {field.label}
              </label>
              <Input
                id={field.id}
                value={field.value}
                onChange={(event) => update(field.id, event.target.value)}
                aria-describedby={`${field.id}-hint`}
              />
              <p id={`${field.id}-hint`} className="text-[11px] text-fog">
                {field.hint}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={busy || !walletClient}
          >
            {!address ? "Connect to ship" : busy ? "Preparing" : "Ship strategy"}
          </Button>
          <p className="text-[12px] text-fog" role="status">
            {status ?? "SDK converts these values into the onchain program."}
          </p>
        </div>
        {(() => {
          const deployment = getDeployment();
          if (!deployment) return null;
          const val = (id: string) =>
            fields.find((field) => field.id === id)?.value ?? "";
          const ethWei = toWei(val("depositEth"));
          const usdcWei = toWei(val("depositUsdc"));
          if (ethWei === null && usdcWei === null) return null;
          return (
            <div className="flex flex-col gap-2">
              {ethWei !== null && ethWei > 0n && (
                <ApproveButton
                  token={strategy.tokenA.address}
                  spender={deployment.aqua}
                  needed={ethWei}
                  symbol={strategy.tokenA.symbol}
                />
              )}
              {usdcWei !== null && usdcWei > 0n && (
                <ApproveButton
                  token={strategy.tokenB.address}
                  spender={deployment.aqua}
                  needed={usdcWei}
                  symbol={strategy.tokenB.symbol}
                />
              )}
            </div>
          );
        })()}
      </Card>
    </form>
  );
}
