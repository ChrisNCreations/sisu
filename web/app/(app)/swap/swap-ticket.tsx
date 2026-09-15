"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { useWalletClient } from "wagmi";
import { parseEther } from "viem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RiskMeter } from "@/components/risk-meter";
import { ApproveButton } from "@/components/approve-button";
import { useWallet } from "@/components/providers";
import {
  appendHistory,
  decodeSwapRevert,
  sdk,
  type Quote,
  type SisuStrategy,
} from "@/lib/sdk";
import { explorerTxUrl, getDeployment, publicClient } from "@/lib/chain";
import {
  formatBps,
  formatPctPrecise,
  formatRiskPrecise,
  formatToken,
} from "@/lib/format";

export function SwapTicket({ strategy }: { strategy: SisuStrategy }) {
  const { address, connect } = useWallet();
  const { data: walletClient } = useWalletClient();
  const [tokenIn, setTokenIn] = useState<"A" | "B">("A");
  const [amount, setAmount] = useState("1");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const inToken = tokenIn === "A" ? strategy.tokenA : strategy.tokenB;
  const outToken = tokenIn === "A" ? strategy.tokenB : strategy.tokenA;
  const amountIn = Number(amount) || 0;

  useEffect(() => {
    let cancelled = false;
    if (amountIn <= 0 || !address) {
      setQuote(null);
      return;
    }
    sdk
      .quoteSwap({
        strategyHash: strategy.hash,
        trader: address as `0x${string}`,
        tokenIn,
        amountIn,
      })
      .then((next) => {
        if (!cancelled) setQuote(next);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, amountIn, strategy.hash, tokenIn]);

  const unsafe = useMemo(
    () =>
      !!quote &&
      (quote.postTradeRiskBps > quote.maxRiskBps || !quote.canExecute),
    [quote],
  );

  async function onSwap() {
    if (!address) {
      connect();
      return;
    }
    if (!quote || !walletClient) return;
    if (!quote.canExecute) {
      setStatus(
        `Trade exceeds strategy risk limit — current ${formatRiskPrecise(quote.currentRiskBps)}, projected ${formatRiskPrecise(quote.postTradeRiskBps)}, max ${formatRiskPrecise(quote.maxRiskBps)}. Submitting anyway: the onchain limit decides.`,
      );
    }
    setBusy(true);
    try {
      const tx = await sdk.swap({
        strategyHash: strategy.hash,
        trader: address as `0x${string}`,
        tokenIn,
        amountIn,
        minAmountOut: quote.amountOut * 0.995,
      });
      const hash = await walletClient.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        setStatus(`Swap settled: ${hash}`);
        setLastTx(hash);
        appendHistory({
          hash,
          timestamp: Date.now(),
          action: "swap",
          success: true,
          tokenIn: inToken.symbol,
          tokenOut: outToken.symbol,
          amountIn,
          amountOut: quote.amountOut,
          feeBps: quote.feeBps,
          riskBeforeBps: quote.currentRiskBps,
          riskAfterBps: quote.postTradeRiskBps,
          direction: tokenIn === "A" ? "AtoB" : "BtoA",
        });
      } else {
        setStatus(
          `Trade exceeds strategy risk limit — current ${formatRiskPrecise(quote.currentRiskBps)}, projected ${formatRiskPrecise(quote.postTradeRiskBps)}, max ${formatRiskPrecise(quote.maxRiskBps)}. No tokens moved.`,
        );
        appendHistory({
          hash,
          timestamp: Date.now(),
          action: "swap",
          success: false,
          tokenIn: inToken.symbol,
          tokenOut: outToken.symbol,
          amountIn,
          amountOut: 0,
          feeBps: quote.feeBps,
          riskBeforeBps: quote.currentRiskBps,
          riskAfterBps: quote.postTradeRiskBps,
          direction: tokenIn === "A" ? "AtoB" : "BtoA",
        });
      }
    } catch (err) {
      const decoded = decodeSwapRevert(err);
      if (decoded) {
        setStatus(
          `Trade exceeds strategy risk limit — current ${formatRiskPrecise(quote.currentRiskBps)}, projected ${formatRiskPrecise(Number(decoded.post))}, max ${formatRiskPrecise(Number(decoded.max))}. No tokens moved.`,
        );
      } else {
        setStatus(
          err instanceof Error ? `Swap failed: ${err.message}` : "Swap failed.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto flex w-full max-w-[420px] flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="amount-in" className="text-[12px] text-fog">
          You pay
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="amount-in"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-describedby="swap-status"
          />
          <span className="w-14 text-right text-[13px] font-[510] text-paper">
            {inToken.symbol}
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          type="button"
          variant="subtle"
          size="icon"
          aria-label="Switch tokens"
          onClick={() => setTokenIn((value) => (value === "A" ? "B" : "A"))}
        >
          <ArrowDownUp aria-hidden />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[12px] text-fog">You receive</p>
        <div className="flex items-center justify-between rounded-[6px] border border-white/8 bg-white/[0.02] px-3.5 py-3">
          <span className="font-mono text-[14px] tabular text-paper">
            {quote ? formatToken(quote.amountOut, "").trim() || "0" : "—"}
          </span>
          <span className="text-[13px] font-[510] text-paper">
            {outToken.symbol}
          </span>
        </div>
      </div>

      <RiskMeter
        currentBps={quote?.currentRiskBps ?? strategy.currentRiskBps}
        projectedBps={quote?.postTradeRiskBps}
        maxBps={strategy.maxRiskBps}
      />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
        <dt className="text-fog">Rate</dt>
        <dd className="text-right font-mono tabular text-mist">
          {quote
            ? `1 ${inToken.symbol} = ${quote.rate.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${outToken.symbol}`
            : "—"}
        </dd>
        <dt className="text-fog">Fee</dt>
        <dd className="text-right font-mono tabular text-mist">
          {quote ? formatBps(quote.feeBps) : "—"}
        </dd>
        <dt className="text-fog">Price impact</dt>
        <dd className="text-right font-mono tabular text-mist">
          {quote ? formatPctPrecise(quote.priceImpactBps) : "—"}
        </dd>
        <dt className="text-fog">Current risk</dt>
        <dd className="text-right font-mono tabular text-mist">
          {quote ? formatRiskPrecise(quote.currentRiskBps) : "—"}
        </dd>
        <dt className="text-fog">Projected risk</dt>
        <dd className="text-right font-mono tabular text-mist">
          {quote ? formatRiskPrecise(quote.postTradeRiskBps) : "—"}
        </dd>
      </dl>

      {unsafe && quote && (
        <p className="rounded-[6px] border border-coral-red/40 px-3 py-2 text-[12px] text-coral-red" role="alert">
          Trade exceeds strategy risk limit — current{" "}
          {formatRiskPrecise(quote.currentRiskBps)}, projected{" "}
          {formatRiskPrecise(quote.postTradeRiskBps)}, max{" "}
          {formatRiskPrecise(quote.maxRiskBps)}.
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={busy || !quote || !walletClient}
        onClick={onSwap}
      >
        {!address
          ? "Connect to swap"
          : busy
            ? "Submitting"
            : unsafe
              ? "Swap anyway"
              : "Swap"}
      </Button>
      {(() => {
        const deployment = getDeployment();
        if (!deployment || amountIn <= 0) return null;
        let amountWei = 0n;
        try {
          amountWei = parseEther(amount);
        } catch {
          return null;
        }
        return (
          <ApproveButton
            token={inToken.address}
            spender={deployment.swapVM}
            needed={amountWei}
            symbol={inToken.symbol}
          />
        );
      })()}
      <p id="swap-status" className="text-[12px] text-fog" role="status">
        {status ??
          "Projected risk is informational. The onchain limit remains authoritative."}
      </p>
      {(() => {
        if (!lastTx) return null;
        const url = explorerTxUrl(lastTx);
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
    </Card>
  );
}
