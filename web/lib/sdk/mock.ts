import type {
  DockParams,
  Hex,
  HistoryEntry,
  Quote,
  QuoteParams,
  RiskSimulation,
  RiskState,
  ShipParams,
  SimulationParams,
  SisuSDK,
  SisuStrategy,
  SwapParams,
  TransactionRequest,
} from "./types";

// Risk fields are onchain 1e9 scale (1e9 = 100%). Fee fields stay in bps.
const RATIO_ONE = 1_000_000_000;

const STRATEGY_HASH =
  "0x7c3a1f90e2b4d8a16c9e5f0a4b7d2e8c1f6a3b9d" as Hex;

const strategy: SisuStrategy = {
  hash: STRATEGY_HASH,
  tokenA: {
    symbol: "ETH",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
  },
  tokenB: {
    symbol: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
  },
  capitalUsd: 100_482,
  allocationA: 0.71,
  allocationB: 0.29,
  targetWeightBps: 5_000,
  maxRiskBps: 600_000_000,
  currentRiskBps: 420_000_000,
  baseFeeBps: 12,
  maxFeeBps: 40,
  currentFeeBps: 25,
  rebalanceStrength: 1.4,
  maxTradeUsd: 18_420,
};

const history: HistoryEntry[] = [
  {
    hash: "0x9f2c18ab44d1e7c0b3a5f8e216d9c4b0a7e1f335",
    timestamp: Date.now() - 1000 * 60 * 18,
    tokenIn: "ETH",
    tokenOut: "USDC",
    amountIn: 2.4,
    amountOut: 8_412.2,
    feeBps: 23,
    riskBeforeBps: 468_000_000,
    riskAfterBps: 420_000_000,
    direction: "AtoB",
  },
  {
    hash: "0x1a7e44c0d9b2f6a83e5c1d0b9f4a2e7c6d8b3a11",
    timestamp: Date.now() - 1000 * 60 * 60 * 5,
    tokenIn: "USDC",
    tokenOut: "ETH",
    amountIn: 3_200,
    amountOut: 0.91,
    feeBps: 26,
    riskBeforeBps: 390_000_000,
    riskAfterBps: 418_000_000,
    direction: "BtoA",
  },
  {
    hash: "0x4d88e1b0c2a9f7d35e6b1c8a0f4d2e9b7c5a1630",
    timestamp: Date.now() - 1000 * 60 * 60 * 26,
    tokenIn: "ETH",
    tokenOut: "USDC",
    amountIn: 1.1,
    amountOut: 3_864.5,
    feeBps: 22,
    riskBeforeBps: 442_000_000,
    riskAfterBps: 405_000_000,
    direction: "AtoB",
  },
];

const ETH_USD = 3_510;
const USDC_USD = 1;

function delay(ms = 90): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dummyTx(): TransactionRequest {
  return {
    to: "0x1111111111111111111111111111111111111111",
    data: "0x",
    value: BigInt(0),
  };
}

function riskBps(valueA: number, valueB: number): number {
  const total = valueA + valueB;
  if (total === 0) return 0;
  const diff = Math.abs(valueA - valueB);
  return Math.round((diff * RATIO_ONE) / total);
}

function quoteFromAmount(params: QuoteParams): Quote {
  const valueA = strategy.capitalUsd * strategy.allocationA;
  const valueB = strategy.capitalUsd * strategy.allocationB;
  const amountInUsd =
    params.tokenIn === "A"
      ? params.amountIn * ETH_USD
      : params.amountIn * USDC_USD;

  const feeBps = strategy.currentFeeBps;
  const feeUsd = (amountInUsd * feeBps) / 10_000;
  const netInUsd = amountInUsd - feeUsd;

  const amountOut =
    params.tokenIn === "A" ? netInUsd / USDC_USD : netInUsd / ETH_USD;

  const newA =
    params.tokenIn === "A" ? valueA + amountInUsd : valueA - netInUsd;
  const newB =
    params.tokenIn === "A" ? valueB - netInUsd : valueB + amountInUsd;

  const currentRiskBps = riskBps(valueA, valueB);
  const postTradeRiskBps = riskBps(Math.max(newA, 0), Math.max(newB, 0));
  const priceImpactBps = Math.min(
    800,
    Math.round((amountInUsd / strategy.capitalUsd) * 1_200),
  );

  const rate =
    params.tokenIn === "A"
      ? amountOut / Math.max(params.amountIn, Number.EPSILON)
      : amountOut / Math.max(params.amountIn, Number.EPSILON);

  return {
    amountIn: params.amountIn,
    amountOut,
    feeBps,
    currentRiskBps,
    postTradeRiskBps,
    maxRiskBps: strategy.maxRiskBps,
    canExecute:
      postTradeRiskBps <= strategy.maxRiskBps &&
      amountInUsd > 0 &&
      amountInUsd <= strategy.maxTradeUsd,
    priceImpactBps,
    rate,
  };
}

export const mockSdk: SisuSDK = {
  async getStrategy() {
    await delay();
    return { ...strategy };
  },

  async listStrategies() {
    await delay();
    return [{ ...strategy }];
  },

  async getRisk() {
    await delay();
    const state: RiskState = {
      currentRiskBps: strategy.currentRiskBps,
      maxRiskBps: strategy.maxRiskBps,
      valueA: strategy.capitalUsd * strategy.allocationA,
      valueB: strategy.capitalUsd * strategy.allocationB,
    };
    return state;
  },

  async quoteSwap(params) {
    await delay(40);
    return quoteFromAmount(params);
  },

  async simulateRisk(params: SimulationParams): Promise<RiskSimulation> {
    const quote = quoteFromAmount(params);
    return {
      currentRiskBps: quote.currentRiskBps,
      postTradeRiskBps: quote.postTradeRiskBps,
      maxRiskBps: quote.maxRiskBps,
      canExecute: quote.canExecute,
    };
  },

  async shipStrategy(_params: ShipParams) {
    await delay(200);
    return dummyTx();
  },

  async dockStrategy(_params: DockParams) {
    await delay(200);
    return dummyTx();
  },

  async swap(_params: SwapParams) {
    await delay(200);
    return dummyTx();
  },

  async getHistory() {
    await delay();
    return [...history];
  },
};

export const DEFAULT_STRATEGY_HASH = STRATEGY_HASH;
