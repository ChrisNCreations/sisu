// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import { Contract, type Provider } from 'ethers';

import type { DeploymentManifest } from './manifest';

const ORDER_TUPLE = {
  type: 'tuple',
  components: [
    { name: 'maker', type: 'address' },
    { name: 'traits', type: 'uint256' },
    { name: 'data', type: 'bytes' },
  ],
} as const;

const ROUTER_ABI = [
  { name: 'AQUA', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'hash', type: 'function', stateMutability: 'view', inputs: [ORDER_TUPLE], outputs: [{ type: 'bytes32' }] },
] as const;

const AQUA_ABI = [
  { name: 'rawBalances', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'bytes32' }, { type: 'address' }], outputs: [{ type: 'uint248' }, { type: 'uint8' }] },
  { name: 'safeBalances', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'bytes32' }, { type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
] as const;

const STRATEGY_ABI = [
  {
    name: 'buildProgram',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'maker', type: 'address' },
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'oracle', type: 'address' },
      { name: 'ethToken', type: 'address' },
      { name: 'maxStaleness', type: 'uint32' },
      { name: 'maxRisk', type: 'uint32' },
      { name: 'baseFee', type: 'uint32' },
      { name: 'maxFee', type: 'uint32' },
      { name: 'rebalanceStrength', type: 'uint32' },
      { name: 'salt', type: 'uint64' },
      { name: 'deadline', type: 'uint40' },
    ],
    outputs: [ORDER_TUPLE],
  },
] as const;

const ERC20_ABI = [
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
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

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const ZERO = '0x0000000000000000000000000000000000000000';
const lower = (value: string): string => value.toLowerCase();

async function contractMetadata(
  provider: Provider,
  label: string,
  address: string,
  errors: string[],
): Promise<{ symbol: string; decimals: number } | null> {
  const token = new Contract(address, ERC20_ABI, provider);
  try {
    const [symbol, decimals] = await Promise.all([token.symbol() as Promise<string>, token.decimals() as Promise<bigint>]);
    return { symbol: String(symbol), decimals: Number(decimals) };
  } catch {
    errors.push(`${label} ${address} does not expose ERC-20 symbol()/decimals().`);
    return null;
  }
}

/**
 * Validates a deployed Sisu stack against its manifest. Fails closed: every problem
 * is collected and returned rather than thrown, so callers can report them all.
 */
export async function validateDeployment(options: {
  provider: Provider;
  manifest: DeploymentManifest;
  expectedChainId?: number;
}): Promise<ValidationResult> {
  const { provider, manifest } = options;
  const errors: string[] = [];
  const warnings: string[] = [];

  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== manifest.chainId) {
    errors.push(`connected chain id ${chainId} does not match manifest.chainId ${manifest.chainId}`);
  }
  if (options.expectedChainId !== undefined && options.expectedChainId !== manifest.chainId) {
    errors.push(`expected chain id ${options.expectedChainId} does not match manifest.chainId ${manifest.chainId}`);
  }

  // 1. Bytecode presence for every address the manifest promises.
  const addresses: Array<[string, string]> = [
    ['aqua', manifest.aqua],
    ['sisuStrategy', manifest.sisuStrategy],
    ['swapVM', manifest.swapVM],
    ['weth', manifest.weth],
    ['eth', manifest.eth],
    ['usdc', manifest.usdc],
    ['aggregator', manifest.aggregator],
    ['ethToken', manifest.ethToken],
  ];
  const seen = new Set<string>();
  for (const [label, address] of addresses) {
    if (address === ZERO) {
      errors.push(`${label} is the zero address`);
      continue;
    }
    if (seen.has(lower(address))) continue;
    seen.add(lower(address));
    const code = await provider.getCode(address);
    if (code === '0x' || code === '0x0') errors.push(`${label} ${address} has no bytecode on chain ${chainId}`);
  }

  // 2. Constructor wiring exposed by public getters.
  const router = new Contract(manifest.swapVM, ROUTER_ABI, provider);
  try {
    const wiredAqua = String(await router.AQUA());
    if (lower(wiredAqua) !== lower(manifest.aqua)) {
      errors.push(`router AQUA() is ${wiredAqua}, expected ${manifest.aqua}`);
    }
    const wiredOwner = String(await router.owner());
    if (manifest.owner !== ZERO && lower(wiredOwner) !== lower(manifest.owner)) {
      errors.push(`router owner() is ${wiredOwner}, expected ${manifest.owner}`);
    }
  } catch {
    errors.push(`swapVM ${manifest.swapVM} does not expose AQUA()/owner(); is it the Sisu router?`);
  }

  // Aqua interface probe: rawBalances must answer (zeroes) rather than revert.
  const aqua = new Contract(manifest.aqua, AQUA_ABI, provider);
  try {
    await aqua.rawBalances(manifest.owner, manifest.swapVM, `0x${'00'.repeat(32)}`, manifest.eth);
  } catch {
    errors.push(`aqua ${manifest.aqua} does not respond to rawBalances(); is it the Aqua contract?`);
  }

  // 3. Token + oracle metadata must match the manifest.
  const ethMeta = await contractMetadata(provider, 'tokens.eth', manifest.eth, errors);
  if (ethMeta) {
    if (ethMeta.decimals !== manifest.tokens.eth.decimals) {
      errors.push(`tokens.eth decimals ${ethMeta.decimals} != manifest ${manifest.tokens.eth.decimals}`);
    }
    if (manifest.tokens.eth.symbol && ethMeta.symbol !== manifest.tokens.eth.symbol) {
      warnings.push(`tokens.eth symbol on-chain "${ethMeta.symbol}" != manifest "${manifest.tokens.eth.symbol}"`);
    }
    if (lower(manifest.tokens.eth.address) !== lower(manifest.eth)) {
      errors.push('tokens.eth.address does not match the eth address');
    }
  }
  const usdcMeta = await contractMetadata(provider, 'tokens.usdc', manifest.usdc, errors);
  if (usdcMeta) {
    if (usdcMeta.decimals !== manifest.tokens.usdc.decimals) {
      errors.push(`tokens.usdc decimals ${usdcMeta.decimals} != manifest ${manifest.tokens.usdc.decimals}`);
    }
    if (manifest.tokens.usdc.symbol && usdcMeta.symbol !== manifest.tokens.usdc.symbol) {
      warnings.push(`tokens.usdc symbol on-chain "${usdcMeta.symbol}" != manifest "${manifest.tokens.usdc.symbol}"`);
    }
    if (lower(manifest.tokens.usdc.address) !== lower(manifest.usdc)) {
      errors.push('tokens.usdc.address does not match the usdc address');
    }
  }

  // On the public network the ETH leg is canonical WETH.
  if (manifest.network === 'sepolia' && lower(manifest.ethToken) !== lower(manifest.weth)) {
    errors.push('on Sepolia ethToken must be the configured WETH address');
  }

  const feed = new Contract(manifest.aggregator, AGGREGATOR_ABI, provider);
  try {
    const [decimals, round] = await Promise.all([
      feed.decimals() as Promise<bigint>,
      feed.latestRoundData() as unknown as Promise<readonly [bigint, bigint, bigint, bigint, bigint]>,
    ]);
    if (Number(decimals) !== manifest.oracle.decimals) {
      errors.push(`oracle decimals ${decimals} != manifest ${manifest.oracle.decimals}`);
    }
    if (lower(manifest.oracle.address) !== lower(manifest.aggregator)) {
      errors.push('oracle.address does not match the aggregator address');
    }
    // 4. Oracle freshness: positive, complete, and within the configured staleness.
    const [roundId, answer, , updatedAt, answeredInRound] = round;
    if (answer <= 0n) errors.push(`oracle answer is non-positive (${answer})`);
    if (answeredInRound < roundId) errors.push(`oracle round ${roundId} is incomplete (answeredInRound ${answeredInRound})`);
    if (updatedAt === 0n) {
      errors.push('oracle has never been updated (updatedAt == 0)');
    } else if (updatedAt > BigInt((await provider.getBlock('latest'))?.timestamp ?? Math.floor(Date.now() / 1000))) {
      errors.push(`oracle update timestamp ${updatedAt} is in the future`);
    } else {
      const now = (await provider.getBlock('latest'))?.timestamp ?? Math.floor(Date.now() / 1000);
      const age = BigInt(now) - updatedAt;
      if (age > BigInt(manifest.oracle.maxStaleness)) {
        errors.push(`oracle is stale: last update ${age}s ago exceeds maxStaleness ${manifest.oracle.maxStaleness}s`);
      }
    }
  } catch {
    errors.push(`aggregator ${manifest.aggregator} is not a readable AggregatorV3 feed`);
  }

  // 5. Configured strategy inputs must reproduce the shipped order.
  if (manifest.orderHash !== undefined && manifest.order !== undefined) {
    try {
      const onchainHash = String(await router.hash(manifest.order));
      if (lower(onchainHash) !== lower(manifest.orderHash)) {
        errors.push(`orderHash mismatch: router.hash(order) is ${onchainHash}, manifest says ${manifest.orderHash}`);
      }
    } catch {
      errors.push('router.hash(order) reverted for the manifest order');
    }

    const { tokenA, tokenB, maker, order, strategy } = manifest;
    if (tokenA && tokenB && maker && strategy.salt !== undefined && strategy.deadline !== undefined) {
      if (lower(tokenA) >= lower(tokenB)) {
        errors.push('tokenA must sort below tokenB');
      }
      try {
        const built = (await new Contract(manifest.sisuStrategy, STRATEGY_ABI, provider).buildProgram(
          maker,
          tokenA,
          tokenB,
          manifest.aggregator,
          manifest.ethToken,
          strategy.maxStaleness,
          strategy.maxRisk,
          strategy.baseFee,
          strategy.maxFee,
          strategy.rebalanceStrength,
          strategy.salt,
          strategy.deadline,
        )) as unknown as readonly [string, bigint, string];
        if (lower(built[2]) !== lower(order.data)) {
          errors.push('shipped order.data does not match buildProgram() for the manifest strategy inputs');
        }
        if (lower(built[0]) !== lower(order.maker)) {
          errors.push('shipped order.maker does not match the manifest maker');
        }
        if (BigInt(built[1]) !== BigInt(order.traits)) {
          errors.push('shipped order.traits does not match buildProgram() for the manifest strategy inputs');
        }
      } catch {
        errors.push('buildProgram() reverted for the manifest strategy inputs');
      }
    } else if (strategy.salt === undefined || strategy.deadline === undefined) {
      warnings.push('strategy.salt/deadline absent: skipped buildProgram() reproduction of the order');
    }
  } else {
    warnings.push('no order/orderHash in manifest: skipped shipped-order and strategy-input checks');
  }

  // 6. Maker approvals + virtual balances exist for the shipped order.
  if (manifest.orderHash !== undefined && manifest.maker !== undefined && manifest.tokenA && manifest.tokenB) {
    try {
      const balances = (await aqua.safeBalances(
        manifest.maker,
        manifest.swapVM,
        manifest.orderHash,
        manifest.tokenA,
        manifest.tokenB,
      )) as unknown as readonly [bigint, bigint];
      if (balances[0] + balances[1] === 0n) {
        errors.push('Aqua virtual balances for the shipped order are zero');
      }
    } catch {
      errors.push('aqua.safeBalances(maker, ...) reverted: the strategy is not active');
    }

    for (const [label, token] of [['tokenA', manifest.tokenA], ['tokenB', manifest.tokenB]] as const) {
      try {
        const allowance = (await new Contract(token, ERC20_ABI, provider).allowance(
          manifest.maker,
          manifest.aqua,
        )) as bigint;
        if (allowance === 0n) errors.push(`maker has no Aqua allowance for ${label} ${token}`);
      } catch {
        errors.push(`could not read maker allowance for ${label} ${token}`);
      }
    }
  }

  return { errors, warnings };
}
