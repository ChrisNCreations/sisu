// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import { Contract, getAddress, type Provider } from 'ethers';

import { SisuConfigError, optionalIntEnv, requireEnv } from './env';

/** Canonical 1e9 ratio scale: 1e9 == 100%. */
export const SISU_BPS = 1_000_000_000n;

/** Canonical reference policy, mirroring `test/utils/sisuFixtures.ts`. */
export const SISU_STRATEGY_DEFAULTS = {
  maxRisk: 600_000_000n, // 60%
  baseFee: 3_000_000n, // 30 bps
  maxFee: 10_000_000n, // 100 bps
  rebalanceStrength: 1_000_000_000n, // 1.0
  maxStaleness: 3_600, // seconds
} as const;

const ERC20_METADATA_ABI = [
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const;

const AGGREGATOR_ABI = [
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  {
    name: 'latestRoundData',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
] as const;

/** Resolved, validated external Sepolia assets consumed by the Sisu deployment. */
export interface ExternalAssetConfig {
  weth: string;
  wethSymbol: string;
  wethDecimals: number;
  usdc: string;
  usdcSymbol: string;
  usdcDecimals: number;
  oracle: string;
  oracleDecimals: number;
  oracleHeartbeat: number;
  maxStaleness: number;
}

function parseAddress(name: string, raw: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    throw new SisuConfigError(`${name} is not a 20-byte hex address: "${raw}".`);
  }
  if (/^0x0{40}$/i.test(raw)) {
    throw new SisuConfigError(`${name} must not be the zero address.`);
  }
  return getAddress(raw);
}

async function assertHasCode(provider: Provider, label: string, address: string): Promise<void> {
  const code = await provider.getCode(address);
  if (code === '0x' || code === '0x0') {
    throw new SisuConfigError(`${label} ${address} has no contract bytecode; check the configured address.`);
  }
}

async function readTokenMetadata(
  provider: Provider,
  label: string,
  address: string,
): Promise<{ symbol: string; decimals: number }> {
  const token = new Contract(address, ERC20_METADATA_ABI, provider);
  let decimals: bigint;
  try {
    decimals = (await token.decimals()) as bigint;
  } catch {
    throw new SisuConfigError(`${label} ${address} does not expose ERC-20 decimals(); is this the right token?`);
  }
  let symbol = '?';
  try {
    symbol = String(await token.symbol());
  } catch {
    // symbol() is optional metadata; decimals() is the load-bearing check.
  }
  return { symbol, decimals: Number(decimals) };
}

/** Validates an optional pinned decimals env value against the live on-chain value. */
function assertDecimalPin(envName: string, actual: number, label: string): void {
  const pinned = optionalIntEnv(envName);
  if (pinned !== undefined && pinned !== actual) {
    throw new SisuConfigError(
      `${envName}=${pinned} does not match the on-chain decimals (${actual}) of ${label}.`,
    );
  }
}

async function readFreshOracle(
  provider: Provider,
  oracle: string,
  maxStaleness: number,
): Promise<{ oracleDecimals: number; answer: bigint; updatedAt: number }> {
  const feed = new Contract(oracle, AGGREGATOR_ABI, provider);
  let round: readonly [bigint, bigint, bigint, bigint, bigint];
  let oracleDecimals: bigint;
  try {
    round = (await feed.latestRoundData()) as unknown as readonly [bigint, bigint, bigint, bigint, bigint];
    oracleDecimals = (await feed.decimals()) as bigint;
  } catch {
    throw new SisuConfigError(`SISU_ORACLE_ADDRESS ${oracle} is not a readable Chainlink AggregatorV3 feed.`);
  }

  const [roundId, answer, , updatedAt, answeredInRound] = round;
  const now = (await provider.getBlock('latest'))?.timestamp ?? Math.floor(Date.now() / 1000);

  if (answer <= 0n) {
    throw new SisuConfigError(`SISU_ORACLE_ADDRESS ${oracle} returned a non-positive answer (${answer}).`);
  }
  if (answeredInRound < roundId) {
    throw new SisuConfigError(
      `SISU_ORACLE_ADDRESS ${oracle} round ${roundId} is incomplete (answeredInRound ${answeredInRound}).`,
    );
  }
  if (updatedAt === 0n) {
    throw new SisuConfigError(`SISU_ORACLE_ADDRESS ${oracle} has never been updated (updatedAt == 0).`);
  }
  if (updatedAt > BigInt(now)) {
    throw new SisuConfigError(
      `SISU_ORACLE_ADDRESS ${oracle} has a future update timestamp (${updatedAt}; current time ${now}).`,
    );
  }
  const age = BigInt(now) - updatedAt;
  if (age > BigInt(maxStaleness)) {
    throw new SisuConfigError(
      `SISU_ORACLE_ADDRESS ${oracle} is stale: last update ${age}s ago exceeds SISU_ORACLE_MAX_STALENESS ${maxStaleness}s.`,
    );
  }

  return { oracleDecimals: Number(oracleDecimals), answer, updatedAt: Number(updatedAt) };
}

/**
 * Reads and validates the external WETH / faucet USDC / Chainlink ETH-USD configuration.
 * Never falls back to mocks: this path is only used on public networks.
 */
export async function resolveExternalAssets(
  provider: Provider,
  chainId: number,
): Promise<ExternalAssetConfig> {
  const weth = parseAddress('SISU_WETH_ADDRESS', requireEnv('SISU_WETH_ADDRESS'));
  const usdc = parseAddress('SISU_USDC_ADDRESS', requireEnv('SISU_USDC_ADDRESS'));
  const oracle = parseAddress('SISU_ORACLE_ADDRESS', requireEnv('SISU_ORACLE_ADDRESS'));

  const maxStaleness = optionalIntEnv('SISU_ORACLE_MAX_STALENESS') ?? SISU_STRATEGY_DEFAULTS.maxStaleness;
  if (maxStaleness <= 0) {
    throw new SisuConfigError(`SISU_ORACLE_MAX_STALENESS must be positive, got ${maxStaleness}.`);
  }
  const oracleHeartbeat = optionalIntEnv('SISU_ORACLE_HEARTBEAT') ?? maxStaleness;
  if (oracleHeartbeat <= 0) {
    throw new SisuConfigError(`SISU_ORACLE_HEARTBEAT must be positive, got ${oracleHeartbeat}.`);
  }

  await assertHasCode(provider, 'SISU_WETH_ADDRESS', weth);
  await assertHasCode(provider, 'SISU_USDC_ADDRESS', usdc);
  await assertHasCode(provider, 'SISU_ORACLE_ADDRESS', oracle);

  const wethMeta = await readTokenMetadata(provider, 'SISU_WETH_ADDRESS', weth);
  const usdcMeta = await readTokenMetadata(provider, 'SISU_USDC_ADDRESS', usdc);

  // The ETH leg must be 18 decimals: SisuValuation scales the oracle price by the token's decimals.
  if (wethMeta.decimals !== 18) {
    throw new SisuConfigError(
      `SISU_WETH_ADDRESS ${weth} reports ${wethMeta.decimals} decimals; the ETH leg must be 18.`,
    );
  }
  if (usdcMeta.decimals < 1 || usdcMeta.decimals > 18) {
    throw new SisuConfigError(
      `SISU_USDC_ADDRESS ${usdc} reports ${usdcMeta.decimals} decimals; expected between 1 and 18.`,
    );
  }
  assertDecimalPin('SISU_WETH_DECIMALS', wethMeta.decimals, 'SISU_WETH_ADDRESS');
  assertDecimalPin('SISU_USDC_DECIMALS', usdcMeta.decimals, 'SISU_USDC_ADDRESS');

  const { oracleDecimals } = await readFreshOracle(provider, oracle, maxStaleness);
  if (oracleDecimals > 38) {
    throw new SisuConfigError(
      `SISU_ORACLE_ADDRESS ${oracle} reports ${oracleDecimals} decimals; expected at most 38.`,
    );
  }
  assertDecimalPin('SISU_ORACLE_DECIMALS', oracleDecimals, 'SISU_ORACLE_ADDRESS');

  console.log(
    `[sisu] external assets on chain ${chainId}: WETH ${weth} (${wethMeta.decimals}d), ` +
      `USDC ${usdc} (${usdcMeta.decimals}d), oracle ${oracle} (${oracleDecimals}d, ` +
      `maxStaleness ${maxStaleness}s)`,
  );

  return {
    weth,
    wethSymbol: wethMeta.symbol,
    wethDecimals: wethMeta.decimals,
    usdc,
    usdcSymbol: usdcMeta.symbol,
    usdcDecimals: usdcMeta.decimals,
    oracle,
    oracleDecimals,
    oracleHeartbeat,
    maxStaleness,
  };
}
