"use client";

import { useState } from "react";
import { useWalletClient } from "wagmi";
import { parseUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApproveButton } from "@/components/approve-button";
import { useWallet } from "@/components/providers";
import { sdk, appendHistory, type SisuStrategy } from "@/lib/sdk";
import { explorerTxUrl, getDeployment, publicClient } from "@/lib/chain";

function toUnits(value: string, decimals: number): bigint | null {
  try {
    return parseUnits(value || "0", decimals);
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [shippedHash, setShippedHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(id: string, value: string) {
    setFields((current) =>
      current.map((field) => (field.id === id ? { ...field, value } : field)),
    );
    setErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function validate(get: (id: string) => string): string | null {
    const found: Record<string, string> = {};
    const num = (id: string) => Number(get(id));
    if (!(num("depositEth") > 0) && !(num("depositUsdc") > 0)) {
      found.depositEth = "Deposit at least one side.";
      found.depositUsdc = "Deposit at least one side.";
    }
    if (!(num("maxRisk") > 0 && num("maxRisk") <= 100)) {
      found.maxRisk = "Use a percent between 1 and 100.";
    }
    if (!(num("baseFee") >= 0)) found.baseFee = "Cannot be negative.";
    if (!(num("maxFee") >= 0)) found.maxFee = "Cannot be negative.";
    if (num("maxFee") < num("baseFee")) {
      found.maxFee = "Must cover the base fee.";
    }
    if (!(num("rebalanceStrength") >= 0)) {
      found.rebalanceStrength = "Cannot be negative.";
    }
    setErrors(found);
    return Object.keys(found).length > 0 ? "Fix the highlighted fields." : null;
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
    setShippedHash(null);
    const get = (id: string) =>
      fields.find((field) => field.id === id)?.value ?? "";
    const blocked = validate(get);
    if (blocked) {
      setStatus(blocked);
      setBusy(false);
      return;
    }
    try {
      const tx = await sdk.shipStrategy({
        maker: address as `0x${string}`,
        tokenA: strategy.tokenA.address,
        tokenB: strategy.tokenB.address,
        depositEth: Number(get("depositEth")),
        depositUsdc: Number(get("depositUsdc")),
        maxRiskPct: Number(get("maxRisk")),
        baseFeeBps: Number(get("baseFee")),
        maxFeeBps: Number(get("maxFee")),
        rebalanceStrength: Number(get("rebalanceStrength")),
        salt: BigInt(Math.floor(Date.now() / 1000)),
      });
      const hash = await walletClient.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus(
        tx.strategyHash
          ? `Strategy shipped: ${tx.strategyHash}`
          : `Strategy shipped: ${hash}`,
      );
      if (tx.strategyHash) setShippedHash(hash);
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
      const message =
        err instanceof Error ? err.message : "Ship failed.";
      setStatus(
        /StrategiesMustBeImmutable/i.test(message)
          ? "That exact strategy is already shipped. Change a value to ship a new one."
          : `Ship failed: ${message}`,
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
          50/50 policy, no target weight. Ships from your connected wallet with
          a time-based salt, so every ship is unique.
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
                aria-describedby={`${field.id}-hint ${field.id}-error`}
                aria-invalid={!!errors[field.id]}
              />
              <p id={`${field.id}-hint`} className="text-[11px] text-fog">
                {field.hint}
              </p>
              {errors[field.id] && (
                <p
                  id={`${field.id}-error`}
                  role="alert"
                  className="text-[11px] text-coral-red"
                >
                  {errors[field.id]}
                </p>
              )}
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
          {(() => {
            if (!shippedHash) return null;
            const url = explorerTxUrl(shippedHash);
            if (!url) return null;
            return (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[12px] tabular text-mist underline decoration-white/20 underline-offset-2"
              >
                View on explorer
              </a>
            );
          })()}
        </div>
        {(() => {
          const deployment = getDeployment();
          if (!deployment) return null;
          const val = (id: string) =>
            fields.find((field) => field.id === id)?.value ?? "";
          const tokenAIsEth =
            strategy.tokenA.address.toLowerCase() === deployment.eth.toLowerCase();
          const amountA = toUnits(
            tokenAIsEth ? val("depositEth") : val("depositUsdc"),
            strategy.tokenA.decimals,
          );
          const amountB = toUnits(
            tokenAIsEth ? val("depositUsdc") : val("depositEth"),
            strategy.tokenB.decimals,
          );
          if (amountA === null && amountB === null) return null;
          return (
            <div className="flex flex-col gap-2">
              {amountA !== null && amountA > 0n && (
                <ApproveButton
                  token={strategy.tokenA.address}
                  spender={deployment.aqua}
                  needed={amountA}
                  symbol={strategy.tokenA.symbol}
                />
              )}
              {amountB !== null && amountB > 0n && (
                <ApproveButton
                  token={strategy.tokenB.address}
                  spender={deployment.aqua}
                  needed={amountB}
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
