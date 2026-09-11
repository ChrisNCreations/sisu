import {
  encodeFunctionData,
  formatEther,
  parseEther,
  type Hex,
} from "viem";
import type {
  DockParams,
  HistoryEntry,
  Quote,
  QuoteParams,
  RiskSimulation,
  ShipParams,
  SimulationParams,
  SisuSDK,
  SisuStrategy,
  SwapParams,
  TransactionRequest,
} from "./types";
import {
  aquaAbi,
  buildTakerTraits,
  decodeRiskLimitExceeded,
  erc20Abi,
  getDeployment,
  publicClient,
  RATIO_ONE,
  strategyAbi,
  swapVMAbi,
  type Deployment,
} from "@/lib/chain";

const NOT_SEEDED = new Error(
  "No seeded Sisu deployment. Run: npx hardhat run scripts/setup-ui.ts --network localhost.",
);

function dep(): Deployment {
  const d = getDeployment();
  if (!d) throw NOT_SEEDED;
  return d;
}

type Order = { maker: Hex; traits: bigint; data: Hex };

function orderOf(d: Deployment): Order {
  return {
    maker: d.order.maker,
    traits: BigInt(d.order.traits),
    data: d.order.data,
  };
}

// --- Onchain risk math port (bigint, mirrors SisuRiskMath) ---
const ONE = BigInt(RATIO_ONE);

function risk1e9(valueA: bigint, valueB: bigint): bigint {
  const total = valueA + valueB;
  if (total === 0n) return 0n;
  const diff = valueA > valueB ? valueA - valueB : valueB - valueA;
  return (diff * ONE) / total;
}

function normalizedRisk(risk: bigint, maxRisk: bigint): bigint {
  const r = (risk * ONE) / maxRisk;
  return r > ONE ? ONE : r;
}

function pressure(valueIn: bigint, valueOut: bigint): number {
  if (valueIn > valueOut) return 1;
  if (valueIn < valueOut) return -1;
  return 0;
}

function finalFee(
  baseFee: bigint,
  maxFee: bigint,
  strength: bigint,
  normRisk: bigint,
  p: number,
): bigint {
  const term = (strength * normRisk) / ONE;
  let m: bigint;
  if (p >= 0) m = ONE + term;
  else if (term >= ONE) m = 0n;
  else m = ONE - term;
  const fee = (baseFee * m) / ONE;
  return fee > maxFee ? maxFee : fee;
}

// --- Mark + balances (demo tokens are 18-decimal TokenMocks) ---
async function markPrice(d: Deployment): Promise<bigint> {
  const res = (await publicClient.readContract({
    address: d.aggregator,
    abi: [
      {
        name: "latestRoundData",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
          { name: "roundId", type: "uint80" },
          { name: "answer", type: "int256" },
          { name: "startedAt", type: "uint256" },
          { name: "updatedAt", type: "uint256" },
          { name: "answeredInRound", type: "uint80" },
        ],
      },
    ],
    functionName: "latestRoundData",
  })) as readonly [bigint, bigint, bigint, bigint, bigint];
  return res[1];
}

function sideValue(
  isEth: boolean,
  amount: bigint,
  price: bigint,
  priceDecimals = 8,
): bigint {
  // Mirrors valueUsd(amount, price, 18, priceDecimals); USDC counts as $1.
  const scale = 10n ** BigInt(priceDecimals);
  if (isEth) return (amount * price) / scale;
  return amount;
}

async function balances(d: Deployment): Promise<{
  balA: bigint;
  balB: bigint;
  valA: bigint;
  valB: bigint;
  price: bigint;
}> {
  const [res, price] = await Promise.all([
    publicClient.readContract({
      address: d.aqua,
      abi: aquaAbi,
      functionName: "safeBalances",
      args: [d.maker, d.swapVM, d.orderHash as Hex, d.tokenA, d.tokenB],
    }),
    markPrice(d),
  ]);
  const balA = res[0] as bigint;
  const balB = res[1] as bigint;
  const aIsEth = d.tokenA.toLowerCase() === d.eth.toLowerCase();
  return {
    balA,
    balB,
    valA: sideValue(aIsEth, balA, price),
    valB: sideValue(!aIsEth, balB, price),
    price,
  };
}

function extractRevertData(err: unknown): Hex | null {
  const seen = new Set<unknown>();
  const queue: unknown[] = [err];
  while (queue.length > 0) {
    const cur = queue.shift() as Record<string, unknown> | null;
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    if (
      typeof cur["data"] === "string" &&
      (cur["data"] as string).startsWith("0x") &&
      (cur["data"] as string).length >= 138
    ) {
      return cur["data"] as Hex;
    }
    for (const v of Object.values(cur)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return null;
}

async function quoteCore(
  d: Deployment,
  params: QuoteParams,
): Promise<Quote> {
  const order = orderOf(d);
  const amountInWei = parseEther(String(params.amountIn));
  const isAToB = params.tokenIn === "A";
  const takerTraits = buildTakerTraits({ taker: d.trader, isAToB });

  const { valA, valB } = await balances(d);
  const inIsEth =
    params.tokenIn === "A" ? d.ethIsA : !d.ethIsA;
  const price = await markPrice(d);
  const currentRisk = risk1e9(valA, valB);
  const maxRisk = BigInt(d.maxRisk);

  let amountOutWei = 0n;
  let postRisk = currentRisk;
  let canExecute = params.amountIn > 0;
  try {
    const res = (await publicClient.readContract({
      address: d.swapVM,
      abi: swapVMAbi,
      functionName: "quote",
      args: [order, amountInWei, takerTraits],
    })) as readonly [bigint, bigint, Hex];
    amountOutWei = res[1];
    const valueInSide = params.tokenIn === "A" ? valA : valB;
    const valueOutSide = params.tokenIn === "A" ? valB : valA;
    const valueIn = sideValue(inIsEth, amountInWei, price);
    const valueOut = sideValue(!inIsEth, amountOutWei, price);
    postRisk =
      valueOut > valueOutSide
        ? ONE
        : risk1e9(valueInSide + valueIn, valueOutSide - valueOut);
    canExecute = canExecute && postRisk <= maxRisk;
  } catch (err) {
    // eth_call reverted: unsafe trade. Decode post/max for the warning.
    const decoded = (() => {
      const data = extractRevertData(err);
      return data ? decodeRiskLimitExceeded(data) : null;
    })();
    if (decoded) postRisk = decoded.post;
    canExecute = false;
  }

  const norm =
    maxRisk === 0n ? ONE : normalizedRisk(currentRisk, maxRisk);
  const p = pressure(
    params.tokenIn === "A" ? valA : valB,
    params.tokenIn === "A" ? valB : valA,
  );
  const fee = finalFee(
    BigInt(d.baseFee),
    BigInt(d.maxFee),
    BigInt(d.rebalanceStrength),
    norm,
    p,
  );

  const amountOut = Number(formatEther(amountOutWei));
  return {
    amountIn: params.amountIn,
    amountOut,
    feeBps: Number(fee) / 1e5,
    currentRiskBps: Number(currentRisk),
    postTradeRiskBps: Number(postRisk),
    maxRiskBps: Number(maxRisk),
    canExecute,
    priceImpactBps: 0,
    rate: params.amountIn > 0 ? amountOut / params.amountIn : 0,
  };
}

async function strategyView(d: Deployment): Promise<SisuStrategy> {
  const { balA, balB, valA, valB, price } = await balances(d);
  const ethPrice = Number(price) / 1e8;
  const aIsEth = d.tokenA.toLowerCase() === d.eth.toLowerCase();
  const capitalUsd =
    Number(formatEther(balA)) * (aIsEth ? ethPrice : 1) +
    Number(formatEther(balB)) * (aIsEth ? 1 : ethPrice);
  const total = valA + valB;
  const currentRisk = risk1e9(valA, valB);
  const maxRisk = BigInt(d.maxRisk);
  const norm =
    maxRisk === 0n ? ONE : normalizedRisk(currentRisk, maxRisk);
  const fee = finalFee(
    BigInt(d.baseFee),
    BigInt(d.maxFee),
    BigInt(d.rebalanceStrength),
    norm,
    pressure(valA, valB),
  );
  return {
    hash: d.orderHash as Hex,
    tokenA: { symbol: "ETH", address: d.eth, decimals: 18 },
    tokenB: { symbol: "USDC", address: d.usdc, decimals: 18 },
    capitalUsd,
    allocationA:
      total === 0n ? 0.5 : Number((valA * 1_000_000n) / total) / 1_000_000,
    allocationB:
      total === 0n ? 0.5 : Number((valB * 1_000_000n) / total) / 1_000_000,
    targetWeightBps: 5_000,
    maxRiskBps: Number(maxRisk),
    currentRiskBps: Number(currentRisk),
    baseFeeBps: Number(BigInt(d.baseFee)) / 1e5,
    maxFeeBps: Number(BigInt(d.maxFee)) / 1e5,
    currentFeeBps: Number(fee) / 1e5,
    rebalanceStrength: Number(BigInt(d.rebalanceStrength)) / 1e9,
    maxTradeUsd: Number(formatEther(maxTradeHintUsd(valA, valB, maxRisk))),
  };
}

/** Derived hint (not policy): largest exact-in USD value (1e18) that keeps
 *  RiskPost <= max in pure value math, ignoring fee and curve. Minimum of
 *  both directions. The onchain Limit remains authoritative. */
function maxTradeHintUsd(valA: bigint, valB: bigint, maxRisk: bigint): bigint {
  const dir = (inA: boolean): bigint => {
    const inSide = inA ? valA : valB;
    const outSide = inA ? valB : valA;
    let lo = 0n;
    let hi = valA + valB + 1n;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2n;
      const post =
        mid >= outSide
          ? ONE
          : risk1e9(inSide + mid, outSide - mid);
      if (post <= maxRisk) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const a = dir(true);
  const b = dir(false);
  return a < b ? a : b;
}

export const realSdk: SisuSDK = {
  async getStrategy() {
    return strategyView(dep());
  },

  async listStrategies() {
    return [await strategyView(dep())];
  },

  async getRisk() {
    const d = dep();
    const { valA, valB } = await balances(d);
    const current = risk1e9(valA, valB);
    return {
      currentRiskBps: Number(current),
      maxRiskBps: Number(BigInt(d.maxRisk)),
      valueA: Number(formatEther(valA)),
      valueB: Number(formatEther(valB)),
    };
  },

  async getBalances() {
    const d = dep();
    const { balA, balB, valA, valB, price } = await balances(d);
    const [wBalA, wBalB] = await Promise.all([
      publicClient.readContract({
        address: d.tokenA,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [d.maker],
      }),
      publicClient.readContract({
        address: d.tokenB,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [d.maker],
      }),
    ]);
    const aIsEth = d.tokenA.toLowerCase() === d.eth.toLowerCase();
    const wValA = sideValue(aIsEth, wBalA as bigint, price);
    const wValB = sideValue(!aIsEth, wBalB as bigint, price);
    return {
      maker: d.maker,
      virtualA: Number(formatEther(balA)),
      virtualB: Number(formatEther(balB)),
      virtualUsdA: Number(formatEther(valA)),
      virtualUsdB: Number(formatEther(valB)),
      walletA: Number(formatEther(wBalA as bigint)),
      walletB: Number(formatEther(wBalB as bigint)),
      walletUsdA: Number(formatEther(wValA)),
      walletUsdB: Number(formatEther(wValB)),
    };
  },

  async quoteSwap(params: QuoteParams) {
    return quoteCore(dep(), params);
  },

  async simulateRisk(params: SimulationParams): Promise<RiskSimulation> {
    const q = await quoteCore(dep(), params);
    return {
      currentRiskBps: q.currentRiskBps,
      postTradeRiskBps: q.postTradeRiskBps,
      maxRiskBps: q.maxRiskBps,
      canExecute: q.canExecute,
    };
  },

  // Populated transactions for the connected wallet to sign. Swap/dock
  // reverts (e.g. SisuRiskLimitExceeded) surface at send time by design.
  async shipStrategy(params: ShipParams) {
    const d = dep();
    const tokenA = params.tokenA;
    const tokenB = params.tokenB;
    const [sortedA, sortedB] =
      tokenA.toLowerCase() < tokenB.toLowerCase()
        ? [tokenA, tokenB]
        : [tokenB, tokenA];
    // Form units → onchain units: pct → 1e9, bps → 1e5, multiplier → 1e9.
    const maxRisk = Math.round((params.maxRiskPct / 100) * RATIO_ONE);
    const baseFee = Math.round(params.baseFeeBps * 1e5);
    const maxFee = Math.round(params.maxFeeBps * 1e5);
    const strength = Math.round(params.rebalanceStrength * 1e9);
    if (maxRisk <= 0) throw new Error("Max risk must be above 0%.");
    if (maxFee < baseFee) throw new Error("Max fee must cover the base fee.");
    const built = (await publicClient.readContract({
      address: d.sisuStrategy,
      abi: strategyAbi,
      functionName: "buildProgram",
      args: [
        params.maker,
        sortedA,
        sortedB,
        d.aggregator,
        d.eth,
        d.maxStaleness,
        maxRisk,
        baseFee,
        maxFee,
        strength,
        params.salt,
        0,
      ],
    })) as unknown as readonly [Hex, bigint, Hex];
    const order: Order = { maker: built[0], traits: built[1], data: built[2] };
    const ethAddr = d.eth.toLowerCase();
    const amtA = parseEther(
      String(
        sortedA.toLowerCase() === ethAddr ? params.depositEth : params.depositUsdc,
      ),
    );
    const amtB = parseEther(
      String(
        sortedB.toLowerCase() === ethAddr ? params.depositEth : params.depositUsdc,
      ),
    );
    const { encodeAbiParameters } = await import("viem");
    const strategy = encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "maker", type: "address" },
            { name: "traits", type: "uint256" },
            { name: "data", type: "bytes" },
          ],
        },
      ],
      [{ maker: order.maker, traits: order.traits, data: order.data }],
    );
    const data = encodeFunctionData({
      abi: aquaAbi,
      functionName: "ship",
      args: [d.swapVM, strategy, [sortedA, sortedB], [amtA, amtB]],
    });
    const strategyHash = (await publicClient.readContract({
      address: d.swapVM,
      abi: swapVMAbi,
      functionName: "hash",
      args: [order],
    })) as Hex;
    return { to: d.aqua, data: data as Hex, value: BigInt(0), strategyHash };
  },

  async dockStrategy(params: DockParams) {
    const d = dep();
    const data = encodeFunctionData({
      abi: aquaAbi,
      functionName: "dock",
      args: [d.swapVM, params.strategyHash as Hex, [d.tokenA, d.tokenB]],
    });
    return { to: d.aqua, data: data as Hex, value: BigInt(0) };
  },

  async swap(params: SwapParams) {
    const d = dep();
    const amountInWei = parseEther(String(params.amountIn));
    const takerTraits = buildTakerTraits({
      taker: d.trader,
      isAToB: params.tokenIn === "A",
    });
    const data = encodeFunctionData({
      abi: swapVMAbi,
      functionName: "swap",
      args: [orderOf(d), amountInWei, takerTraits],
    });
    return { to: d.swapVM, data: data as Hex, value: BigInt(0) };
  },

  async getHistory(): Promise<HistoryEntry[]> {
    // No indexer by design (ADR 0004): session log lives in localStorage.
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("sisu:history:v1");
      if (!raw) return [];
      return JSON.parse(raw) as HistoryEntry[];
    } catch {
      return [];
    }
  },
};

export function appendHistory(entry: HistoryEntry) {
  try {
    const raw = window.localStorage.getItem("sisu:history:v1");
    const list = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    list.unshift(entry);
    window.localStorage.setItem(
      "sisu:history:v1",
      JSON.stringify(list.slice(0, 50)),
    );
    window.dispatchEvent(new Event("sisu:history"));
  } catch {
    // Session log is best-effort.
  }
}

export function decodeSwapRevert(err: unknown): {
  post: bigint;
  max: bigint;
} | null {
  const data = extractRevertData(err);
  return data ? decodeRiskLimitExceeded(data) : null;
}
