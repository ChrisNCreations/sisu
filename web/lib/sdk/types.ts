export type Hex = `0x${string}`;

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

export interface QuoteParams {
  strategyHash: Hex;
  tokenIn: "A" | "B";
  amountIn: number;
}

export interface Quote {
  amountIn: number;
  amountOut: number;
  feeBps: number;
  currentRiskBps: number;
  postTradeRiskBps: number;
  maxRiskBps: number;
  canExecute: boolean;
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
  tokenA: Hex;
  tokenB: Hex;
  capital: number;
  targetWeight: number;
  maxRisk: number;
  baseFee: number;
  maxFee: number;
  rebalanceStrength: number;
  maxTrade: number;
}

export interface DockParams {
  strategyHash: Hex;
}

export interface SwapParams {
  strategyHash: Hex;
  tokenIn: "A" | "B";
  amountIn: number;
  minAmountOut: number;
}

export interface TransactionRequest {
  to: Hex;
  data: Hex;
  value: bigint;
}

export interface HistoryEntry {
  hash: Hex;
  timestamp: number;
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
  quoteSwap(params: QuoteParams): Promise<Quote>;
  simulateRisk(params: SimulationParams): Promise<RiskSimulation>;
  shipStrategy(params: ShipParams): Promise<TransactionRequest>;
  dockStrategy(params: DockParams): Promise<TransactionRequest>;
  swap(params: SwapParams): Promise<TransactionRequest>;
  getHistory(strategyHash: Hex): Promise<HistoryEntry[]>;
}
