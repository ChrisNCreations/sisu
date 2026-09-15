export type Hex = `0x${string}`;

// Unit contract — read before touching risk or fee numbers:
// - Fields ending in `RiskBps` are misnamed for history's sake: they carry
//   the onchain 1e9 ratio (1_000_000_000 = 100%). Render with
//   formatRisk/formatRiskPrecise, never formatPct/formatBps.
// - `*FeeBps` / `priceImpactBps` are true 1e4 bps. Render with
//   formatBps/formatPctPrecise.
// - `targetWeightBps` is true 1e4 bps (5_000 = 50/50, ADR-0001).
export interface SisuStrategy {
  hash: Hex;
  tokenA: { symbol: string; address: Hex; decimals: number };
  tokenB: { symbol: string; address: Hex; decimals: number };
  capitalUsd: number;
  allocationA: number;
  allocationB: number;
  targetWeightBps: number;
  maxRiskBps: number;
  currentRiskBps: number;
  baseFeeBps: number;
  maxFeeBps: number;
  currentFeeBps: number;
  rebalanceStrength: number;
  maxTradeUsd: number;
}

export interface RiskState {
  currentRiskBps: number;
  maxRiskBps: number;
  valueA: number;
  valueB: number;
}

export interface Balances {
  maker: Hex;
  virtualA: number;
  virtualB: number;
  virtualUsdA: number;
  virtualUsdB: number;
  walletA: number;
  walletB: number;
  walletUsdA: number;
  walletUsdB: number;
}

export interface QuoteParams {
  strategyHash: Hex;
  trader: Hex;
  tokenIn: "A" | "B";
  amountIn: number;
}

export interface Quote {
  amountIn: number;
  amountOut: number;
  /** True 1e4 bps. */
  feeBps: number;
  /** Onchain 1e9 scale (see unit contract above). */
  currentRiskBps: number;
  /** Onchain 1e9 scale (see unit contract above). */
  postTradeRiskBps: number;
  /** Onchain 1e9 scale (see unit contract above). */
  maxRiskBps: number;
  /** Hint only. The onchain Limit stays authoritative. */
  canExecute: boolean;
  /** True 1e4 bps. Curve-only impact; Fee is reported separately. */
  priceImpactBps: number;
  rate: number;
}

export interface SimulationParams extends QuoteParams {}

export interface RiskSimulation {
  currentRiskBps: number;
  postTradeRiskBps: number;
  maxRiskBps: number;
  canExecute: boolean;
}

export interface ShipParams {
  maker: Hex;
  tokenA: Hex;
  tokenB: Hex;
  depositEth: number;
  depositUsdc: number;
  maxRiskPct: number;
  baseFeeBps: number;
  maxFeeBps: number;
  rebalanceStrength: number;
  salt: bigint;
}

export interface DockParams {
  strategyHash: Hex;
}

export interface SwapParams {
  strategyHash: Hex;
  trader: Hex;
  tokenIn: "A" | "B";
  amountIn: number;
  /** Token units. Wired into the SwapVM threshold (min output). */
  minAmountOut: number;
}

export interface TransactionRequest {
  to: Hex;
  data: Hex;
  value: bigint;
  strategyHash?: Hex;
}

export interface HistoryEntry {
  hash: Hex;
  timestamp: number;
  action: "swap" | "ship" | "dock";
  success: boolean;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  feeBps: number;
  riskBeforeBps: number;
  riskAfterBps: number;
  direction: "AtoB" | "BtoA";
}

export interface SisuSDK {
  getStrategy(strategyHash: Hex): Promise<SisuStrategy>;
  listStrategies(): Promise<SisuStrategy[]>;
  getRisk(strategyHash: Hex): Promise<RiskState>;
  getBalances(strategyHash: Hex): Promise<Balances>;
  quoteSwap(params: QuoteParams): Promise<Quote>;
  simulateRisk(params: SimulationParams): Promise<RiskSimulation>;
  shipStrategy(params: ShipParams): Promise<TransactionRequest>;
  dockStrategy(params: DockParams): Promise<TransactionRequest>;
  swap(params: SwapParams): Promise<TransactionRequest>;
  getHistory(strategyHash: Hex): Promise<HistoryEntry[]>;
}
