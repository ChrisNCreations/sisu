// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import { SISU_BPS } from './sisuConfig';

/** Increments whenever the manifest shape changes incompatibly. */
export const MANIFEST_VERSION = 1;

export interface TokenMeta {
  address: string;
  symbol: string;
  decimals: number;
}

export interface OracleMeta {
  address: string;
  decimals: number;
  heartbeat: number;
  maxStaleness: number;
}

export interface StrategyPolicy {
  maxRisk: string;
  baseFee: string;
  maxFee: string;
  rebalanceStrength: string;
  maxStaleness: number;
  salt?: string;
  deadline?: number;
}

export interface OrderRecord {
  maker: string;
  traits: string;
  data: string;
}

/**
 * Versioned Sisu deployment manifest. The first block (config) is always present;
 * the order block is filled in once a maker ships the canonical strategy.
 */
export interface DeploymentManifest {
  manifestVersion: number;
  network: string;
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string | null;
  deploymentBlock: number;
  owner: string;
  aqua: string;
  sisuStrategy: string;
  swapVM: string;
  weth: string;
  eth: string;
  usdc: string;
  ethToken: string;
  aggregator: string;
  tokens: { eth: TokenMeta; usdc: TokenMeta };
  oracle: OracleMeta;
  strategy: StrategyPolicy;
  // Canonical order identity (present after the seed/ship step).
  tokenA?: string;
  tokenB?: string;
  ethIsA?: boolean;
  maker?: string;
  trader?: string;
  order?: OrderRecord;
  orderHash?: string;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const HEX = /^0x[0-9a-fA-F]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkAddress(problems: string[], path: string, value: unknown): void {
  if (typeof value !== 'string' || !ADDRESS.test(value)) {
    problems.push(`${path} must be a 20-byte hex address`);
    return;
  }
  if (/^0x0{40}$/i.test(value)) problems.push(`${path} must not be the zero address`);
}

function checkBigInt(problems: string[], path: string, value: unknown, min: bigint, max: bigint): bigint | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    problems.push(`${path} must be a decimal integer string`);
    return null;
  }
  const parsed = BigInt(value);
  if (parsed < min || parsed > max) {
    problems.push(`${path} must be between ${min} and ${max}, got ${parsed}`);
    return null;
  }
  return parsed;
}

function checkDecimals(problems: string[], path: string, value: unknown, max: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    problems.push(`${path} must be an integer between 0 and ${max}`);
  }
}

function checkPositiveInt(problems: string[], path: string, value: unknown): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    problems.push(`${path} must be a positive integer`);
  }
}

function checkTokenMeta(problems: string[], path: string, value: unknown): void {
  if (!isRecord(value)) {
    problems.push(`${path} must be an object`);
    return;
  }
  checkAddress(problems, `${path}.address`, value.address);
  if (typeof value.symbol !== 'string' || value.symbol.length === 0) problems.push(`${path}.symbol must be a non-empty string`);
  checkDecimals(problems, `${path}.decimals`, value.decimals, 18);
}

/**
 * Validates a manifest's shape and internal policy invariants. Returns a list of
 * human-readable problems; an empty list means the manifest is structurally sound.
 * Does not touch the network.
 */
export function validateManifest(input: unknown): string[] {
  const problems: string[] = [];
  if (!isRecord(input)) return ['manifest must be a JSON object'];
  const m = input;

  if (typeof m.manifestVersion !== 'number' || !Number.isInteger(m.manifestVersion)) {
    problems.push('manifestVersion must be an integer');
  } else if (m.manifestVersion !== MANIFEST_VERSION) {
    problems.push(`manifestVersion ${m.manifestVersion} is not supported (expected ${MANIFEST_VERSION})`);
  }

  if (typeof m.network !== 'string' || m.network.length === 0) problems.push('network must be a non-empty string');
  if (typeof m.chainId !== 'number' || !Number.isInteger(m.chainId) || m.chainId <= 0) problems.push('chainId must be a positive integer');
  if (typeof m.rpcUrl !== 'string') problems.push('rpcUrl must be a string');
  if (m.explorerBaseUrl !== null && typeof m.explorerBaseUrl !== 'string') problems.push('explorerBaseUrl must be a string or null');
  if (typeof m.deploymentBlock !== 'number' || !Number.isInteger(m.deploymentBlock) || m.deploymentBlock < 0) {
    problems.push('deploymentBlock must be a non-negative integer');
  }

  for (const key of ['owner', 'aqua', 'sisuStrategy', 'swapVM', 'weth', 'eth', 'usdc', 'ethToken', 'aggregator'] as const) {
    checkAddress(problems, key, m[key]);
  }

  if (!isRecord(m.tokens)) {
    problems.push('tokens must be an object');
  } else {
    checkTokenMeta(problems, 'tokens.eth', m.tokens.eth);
    checkTokenMeta(problems, 'tokens.usdc', m.tokens.usdc);
  }

  if (!isRecord(m.oracle)) {
    problems.push('oracle must be an object');
  } else {
    checkAddress(problems, 'oracle.address', m.oracle.address);
    checkDecimals(problems, 'oracle.decimals', m.oracle.decimals, 38);
    checkPositiveInt(problems, 'oracle.heartbeat', m.oracle.heartbeat);
    checkPositiveInt(problems, 'oracle.maxStaleness', m.oracle.maxStaleness);
    if (typeof m.oracle.heartbeat === 'number' && typeof m.oracle.maxStaleness === 'number' && m.oracle.heartbeat > m.oracle.maxStaleness) {
      problems.push('oracle.heartbeat must not exceed oracle.maxStaleness');
    }
  }

  if (!isRecord(m.strategy)) {
    problems.push('strategy must be an object');
  } else {
    const maxRisk = checkBigInt(problems, 'strategy.maxRisk', m.strategy.maxRisk, 1n, SISU_BPS);
    const baseFee = checkBigInt(problems, 'strategy.baseFee', m.strategy.baseFee, 0n, SISU_BPS);
    const maxFee = checkBigInt(problems, 'strategy.maxFee', m.strategy.maxFee, 0n, SISU_BPS);
    checkBigInt(problems, 'strategy.rebalanceStrength', m.strategy.rebalanceStrength, 0n, SISU_BPS);
    checkPositiveInt(problems, 'strategy.maxStaleness', m.strategy.maxStaleness);
    if (baseFee !== null && maxFee !== null && baseFee > maxFee) {
      problems.push('strategy.baseFee must not exceed strategy.maxFee');
    }
    if (maxRisk !== null && maxRisk === 0n) problems.push('strategy.maxRisk must be above 0');
  }

  // Order identity is optional (absent before the ship step) but validated when present.
  if (m.tokenA !== undefined) checkAddress(problems, 'tokenA', m.tokenA);
  if (m.tokenB !== undefined) checkAddress(problems, 'tokenB', m.tokenB);
  if (m.maker !== undefined) checkAddress(problems, 'maker', m.maker);
  if (m.trader !== undefined) checkAddress(problems, 'trader', m.trader);
  if (m.ethIsA !== undefined && typeof m.ethIsA !== 'boolean') problems.push('ethIsA must be a boolean');
  if (m.orderHash !== undefined && (typeof m.orderHash !== 'string' || !BYTES32.test(m.orderHash))) {
    problems.push('orderHash must be a 32-byte hex string');
  }
  if (m.order !== undefined) {
    if (!isRecord(m.order)) {
      problems.push('order must be an object');
    } else {
      checkAddress(problems, 'order.maker', m.order.maker);
      if (typeof m.order.traits !== 'string' || !/^\d+$/.test(m.order.traits)) problems.push('order.traits must be a decimal integer string');
      if (typeof m.order.data !== 'string' || !HEX.test(m.order.data)) problems.push('order.data must be hex');
    }
  }

  return problems;
}
