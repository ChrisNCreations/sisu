import { createPublicClient, defineChain, http, type Hex } from "viem";
import example from "./deployment.example.json";

export const RATIO_ONE = 1_000_000_000; // onchain 1e9 = 100%
export const LOCAL_RPC = "http://127.0.0.1:8545";

export interface Deployment {
  chainId: number;
  rpcUrl: string;
  aqua: Hex;
  sisuStrategy: Hex;
  swapVM: Hex;
  weth: Hex;
  eth: Hex;
  usdc: Hex;
  tokenA: Hex;
  tokenB: Hex;
  ethIsA: boolean;
  aggregator: Hex;
  ethToken: Hex;
  maxStaleness: number;
  maxRisk: string;
  baseFee: string;
  maxFee: string;
  rebalanceStrength: string;
  maker: Hex;
  trader: Hex;
  order: { maker: Hex; traits: string; data: Hex };
  orderHash: Hex;
}

const ZERO = "0x0000000000000000000000000000000000000000" as Hex;

let cached: Deployment | null = null;

export function getDeployment(): Deployment | null {
  if (cached) return cached;
  let loaded: Deployment | null = null;
  try {
    // Written by sisu/scripts/setup-ui.ts. Bundled at build time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const req = require("./deployment.json") as Deployment;
    if (req && req.swapVM && req.swapVM !== ZERO) loaded = req;
  } catch {
    loaded = null;
  }
  cached = loaded;
  return loaded;
}

export function isSeeded(): boolean {
  return getDeployment() !== null;
}

export function getExampleDeployment(): Deployment {
  return example as Deployment;
}

/** RPC + chain id follow the seed output; localhost when unseeded. */
export function deploymentRpc(): string {
  return getDeployment()?.rpcUrl || LOCAL_RPC;
}

export function deploymentChainId(): number {
  return getDeployment()?.chainId ?? 31337;
}

export const hardhatChain = defineChain({
  id: deploymentChainId(),
  name: "Sisu",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: [deploymentRpc()] },
  },
});

export const publicClient = createPublicClient({
  chain: hardhatChain,
  transport: http(deploymentRpc()),
});

const orderTuple = {
  type: "tuple",
  components: [
    { name: "maker", type: "address" },
    { name: "traits", type: "uint256" },
    { name: "data", type: "bytes" },
  ],
} as const;

export const swapVMAbi = [
  {
    name: "quote",
    type: "function",
    stateMutability: "view",
    inputs: [
      { ...orderTuple, name: "order" },
      { name: "amount", type: "uint256" },
      { name: "takerTraitsAndData", type: "bytes" },
    ],
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOut", type: "uint256" },
      { name: "orderHash", type: "bytes32" },
    ],
  },
  {
    name: "swap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { ...orderTuple, name: "order" },
      { name: "amount", type: "uint256" },
      { name: "takerTraitsAndData", type: "bytes" },
    ],
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOut", type: "uint256" },
      { name: "orderHash", type: "bytes32" },
    ],
  },
  {
    name: "hash",
    type: "function",
    stateMutability: "view",
    inputs: [{ ...orderTuple, name: "order" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export const aquaAbi = [
  {
    name: "ship",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "app", type: "address" },
      { name: "strategy", type: "bytes" },
      { name: "tokens", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [{ name: "strategyHash", type: "bytes32" }],
  },
  {
    name: "dock",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "app", type: "address" },
      { name: "strategyHash", type: "bytes32" },
      { name: "tokens", type: "address[]" },
    ],
    outputs: [],
  },
  {
    name: "safeBalances",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "maker", type: "address" },
      { name: "app", type: "address" },
      { name: "strategyHash", type: "bytes32" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
    ],
    outputs: [
      { name: "balance0", type: "uint256" },
      { name: "balance1", type: "uint256" },
    ],
  },
] as const;

export const strategyAbi = [
  {
    name: "buildProgram",
    type: "function",
    stateMutability: "pure",
    inputs: [
      { name: "maker", type: "address" },
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "oracle", type: "address" },
      { name: "ethToken", type: "address" },
      { name: "maxStaleness", type: "uint32" },
      { name: "maxRisk", type: "uint32" },
      { name: "baseFee", type: "uint32" },
      { name: "maxFee", type: "uint32" },
      { name: "rebalanceStrength", type: "uint32" },
      { name: "salt", type: "uint64" },
      { name: "deadline", type: "uint40" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "maker", type: "address" },
          { name: "traits", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
  },
] as const;

export const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export async function readAllowance(
  token: Hex,
  owner: Hex,
  spender: Hex,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;
}

// SisuRiskLimitExceeded(uint256 postRiskBps, uint256 maxRiskBps)
export const riskLimitExceededSelector = "0xbd870a2b";

export function decodeRiskLimitExceeded(data: Hex): {
  post: bigint;
  max: bigint;
} | null {
  const selector = data.slice(0, 10).toLowerCase();
  if (selector !== riskLimitExceededSelector) return null;
  try {
    const post = BigInt(`0x${data.slice(10, 74)}`);
    const max = BigInt(`0x${data.slice(74, 138)}`);
    return { post, max };
  } catch {
    return null;
  }
}

// --- Taker traits (port of sisu/test/utils/SwapVMHelpers.ts) ---
const IS_EXACT_IN = 0x0001;
const USE_TRANSFER_FROM_AND_AQUA_PUSH = 0x0040;
const IS_A_TO_B = 0x0080;

function hexBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function padLeftBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let v = value;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

export function buildTakerTraits(opts: {
  taker: Hex;
  isAToB: boolean;
  threshold?: bigint;
}): Hex {
  const thresholdBytes =
    opts.threshold && opts.threshold > 0n
      ? padLeftBytes(opts.threshold, 32)
      : new Uint8Array(0);
  const index0 = BigInt(thresholdBytes.length);
  const slices = padLeftBytes(index0, 20);
  let flags = 0;
  flags |= IS_EXACT_IN;
  flags |= USE_TRANSFER_FROM_AND_AQUA_PUSH;
  if (opts.isAToB) flags |= IS_A_TO_B;
  const packed = concatBytes([
    slices,
    padLeftBytes(BigInt(flags), 2),
    thresholdBytes,
  ]);
  let hex = "0x";
  for (const b of packed) hex += b.toString(16).padStart(2, "0");
  return hex as Hex;
}

export function takerTraitsFor(opts: {
  taker: Hex;
  tokenIn: "A" | "B";
  ethIsA: boolean;
}): Hex {
  // isAToB refers to tokenA -> tokenB direction of the pair.
  const isAToB = opts.tokenIn === "A";
  return buildTakerTraits({ taker: opts.taker, isAToB });
}

/** Explorer base URL for the seeded chain, or null (local node). */
export function explorerBase(): string | null {
  const id = deploymentChainId();
  if (id === 11155111) return "https://sepolia.etherscan.io";
  return null;
}

export function explorerTxUrl(hash: string): string | null {
  const base = explorerBase();
  return base ? `${base}/tx/${hash}` : null;
}

export function explorerAddressUrl(address: string): string | null {
  const base = explorerBase();
  return base ? `${base}/address/${address}` : null;
}

export { hexBytes };
