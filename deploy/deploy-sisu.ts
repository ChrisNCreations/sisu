// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import 'hardhat-deploy';
import * as fs from 'fs';
import * as path from 'path';

import {
  SEPOLIA_CHAIN_ID,
  SisuConfigError,
  isLocalNetwork,
  requireLiveDeploymentConfirmation,
} from './env';
import { SISU_STRATEGY_DEFAULTS, resolveExternalAssets } from './sisuConfig';
import { MANIFEST_VERSION, validateManifest, type DeploymentManifest } from './manifest';
import { validateDeployment } from './validate';

// Local ETH/USD mark: 3000e8, 8 decimals. Matches sisuFixtures ETH_USD.
const LOCAL_ETH_USD = 3000n * 10n ** 8n;
const LOCAL_ORACLE_DECIMALS = 8;

/**
 * Sisu product deploy path.
 *
 * Local (hardhat/localhost): deploy Aqua, SisuStrategy, the Sisu router, and the
 * local WETH / ETH / USDC / aggregator mocks.
 *
 * Public networks (Sepolia): deploy only Sisu-owned contracts and consume the
 * configured external WETH, faucet USDC, and Chainlink ETH/USD feed. Mock assets
 * are never deployed outside local networks.
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const provider = ethers.provider;

  const local = isLocalNetwork(network.name);
  const chainId = Number((await provider.getNetwork()).chainId);
  const waitConfirmations = local ? 1 : 3;

  requireLiveDeploymentConfirmation(network.name);

  if (network.name === 'sepolia' && chainId !== SEPOLIA_CHAIN_ID) {
    throw new SisuConfigError(
      `network "sepolia" is connected to chain id ${chainId}, expected ${SEPOLIA_CHAIN_ID}. Check SEPOLIA_RPC_URL.`,
    );
  }
  if (!local && chainId === SEPOLIA_CHAIN_ID && network.name !== 'sepolia') {
    console.warn(`[sisu] chain id ${chainId} is Sepolia but the network is "${network.name}".`);
  }

  console.log(`[sisu] deploying on ${network.name} (chain ${chainId}) as ${deployer}`);

  // External assets are resolved (and validated) before any transaction is sent.
  const external = local ? null : await resolveExternalAssets(provider, chainId);

  // Sisu-owned contracts, on every network.
  const aquaDeploy = await deploy('Aqua', { from: deployer, args: [], log: true, waitConfirmations });
  const strategyDeploy = await deploy('SisuStrategy', {
    from: deployer,
    args: [aquaDeploy.address],
    log: true,
    waitConfirmations,
  });

  let weth: string;
  let eth: string;
  let usdc: string;
  let aggregator: string;
  let ethToken: string;
  let ethSymbol: string;
  let ethDecimals: number;
  let usdcSymbol: string;
  let usdcDecimals: number;
  let oracleDecimals: number;
  let oracleHeartbeat: number;
  let maxStaleness: number;

  if (local) {
    // Local mock workflow (unchanged): WETH for the router, ETH/USDC mocks for the book.
    const wethDeploy = await deploy('WETHMock', { from: deployer, args: [], log: true, waitConfirmations });
    const ethDeploy = await deploy('SisuETH', {
      contract: 'TokenMock',
      from: deployer,
      args: ['ETH', 'ETH'],
      log: true,
      waitConfirmations,
    });
    const usdcDeploy = await deploy('SisuUSDC', {
      contract: 'TokenMock',
      from: deployer,
      args: ['USDC', 'USDC'],
      log: true,
      waitConfirmations,
    });
    const aggregatorDeploy = await deploy('SisuAggregator', {
      contract: 'MockAggregatorV3',
      from: deployer,
      args: [LOCAL_ORACLE_DECIMALS, LOCAL_ETH_USD],
      log: true,
      waitConfirmations,
    });

    weth = wethDeploy.address;
    eth = ethDeploy.address;
    usdc = usdcDeploy.address;
    aggregator = aggregatorDeploy.address;
    ethToken = ethDeploy.address;
    ethSymbol = 'ETH';
    ethDecimals = 18;
    usdcSymbol = 'USDC';
    usdcDecimals = 18;
    oracleDecimals = LOCAL_ORACLE_DECIMALS;
    oracleHeartbeat = SISU_STRATEGY_DEFAULTS.maxStaleness;
    maxStaleness = SISU_STRATEGY_DEFAULTS.maxStaleness;
  } else {
    // Public network: validated external assets only. No mocks.
    const assets = external!;
    weth = assets.weth;
    eth = assets.weth; // The ETH leg is canonical WETH; Aqua/Sisu settle ERC-20 pairs.
    usdc = assets.usdc;
    aggregator = assets.oracle;
    ethToken = assets.weth;
    ethSymbol = assets.wethSymbol;
    ethDecimals = assets.wethDecimals;
    usdcSymbol = assets.usdcSymbol;
    usdcDecimals = assets.usdcDecimals;
    oracleDecimals = assets.oracleDecimals;
    oracleHeartbeat = assets.oracleHeartbeat;
    maxStaleness = assets.maxStaleness;
  }

  const routerArgs = [aquaDeploy.address, weth, deployer, 'SisuSwapVM', '1.0.0'];
  const routerDeploy = await deploy('SisuSwapVMRouter', {
    from: deployer,
    args: routerArgs,
    log: true,
    waitConfirmations,
  });

  const deploymentBlock = await provider.getBlockNumber();
  const explorerBaseUrl = network.name === 'sepolia' ? 'https://sepolia.etherscan.io' : null;

  const manifest: DeploymentManifest = {
    manifestVersion: MANIFEST_VERSION,
    network: network.name,
    chainId,
    rpcUrl: (network.config as { url?: string }).url ?? '',
    explorerBaseUrl,
    deploymentBlock,
    owner: deployer,
    aqua: aquaDeploy.address,
    sisuStrategy: strategyDeploy.address,
    swapVM: routerDeploy.address,
    weth,
    eth,
    usdc,
    ethToken,
    aggregator,
    tokens: {
      eth: { address: eth, symbol: ethSymbol, decimals: ethDecimals },
      usdc: { address: usdc, symbol: usdcSymbol, decimals: usdcDecimals },
    },
    oracle: {
      address: aggregator,
      decimals: oracleDecimals,
      heartbeat: oracleHeartbeat,
      maxStaleness,
    },
    strategy: {
      maxRisk: SISU_STRATEGY_DEFAULTS.maxRisk.toString(),
      baseFee: SISU_STRATEGY_DEFAULTS.baseFee.toString(),
      maxFee: SISU_STRATEGY_DEFAULTS.maxFee.toString(),
      rebalanceStrength: SISU_STRATEGY_DEFAULTS.rebalanceStrength.toString(),
      maxStaleness,
    },
    // Legacy flat fields kept for the web client's existing reads.
    maxStaleness,
    maxRisk: SISU_STRATEGY_DEFAULTS.maxRisk.toString(),
    baseFee: SISU_STRATEGY_DEFAULTS.baseFee.toString(),
    maxFee: SISU_STRATEGY_DEFAULTS.maxFee.toString(),
    rebalanceStrength: SISU_STRATEGY_DEFAULTS.rebalanceStrength.toString(),
  } as DeploymentManifest & Record<string, unknown>;

  const outDir = path.join(__dirname, '../deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `sisu-${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));

  const manifestProblems = validateManifest(manifest);
  if (manifestProblems.length > 0) {
    throw new SisuConfigError(`generated deployment manifest is invalid: ${manifestProblems.join('; ')}`);
  }
  const validation = await validateDeployment({
    provider,
    manifest,
    expectedChainId: chainId,
  });
  if (validation.errors.length > 0) {
    throw new SisuConfigError(`post-deployment validation failed: ${validation.errors.join('; ')}`);
  }
  for (const warning of validation.warnings) {
    console.warn(`[sisu] post-deployment validation warning: ${warning}`);
  }

  console.log('\n=== Sisu Deployment Summary ===');
  console.log(`Network:          ${network.name} (chain ${chainId})`);
  console.log(`Aqua:             ${aquaDeploy.address}`);
  console.log(`SisuStrategy:     ${strategyDeploy.address}`);
  console.log(`SisuSwapVMRouter: ${routerDeploy.address}`);
  console.log(`WETH:             ${weth}`);
  console.log(`ETH leg:          ${eth}`);
  console.log(`USDC:             ${usdc}`);
  console.log(`Oracle:           ${aggregator} (${oracleDecimals}d)`);
  console.log(`Manifest:         ${outPath}`);
  console.log('===============================\n');

  // Verify on Etherscan when configured and not local (same pattern as deploy-aqua.ts).
  if (!local && process.env.ETHERSCAN_API_KEY) {
    console.log('Waiting for block confirmations...');
    await new Promise((resolve) => setTimeout(resolve, 30000));

    console.log('Verifying Sisu contracts...');
    const toVerify: { address: string; args: unknown[]; label: string }[] = [
      { address: aquaDeploy.address, args: [], label: 'Aqua' },
      { address: strategyDeploy.address, args: [aquaDeploy.address], label: 'SisuStrategy' },
      { address: routerDeploy.address, args: routerArgs, label: 'SisuSwapVMRouter' },
    ];
    for (const c of toVerify) {
      try {
        await hre.run('verify:verify', { address: c.address, constructorArguments: c.args });
        console.log(`${c.label} verified`);
      } catch (error) {
        console.error(`Failed to verify ${c.label}:`, error);
      }
    }
  } else if (!local) {
    console.log('[sisu] ETHERSCAN_API_KEY not set; skipping contract verification.');
  }
};

export default func;
func.tags = ['Sisu', 'SisuStrategy', 'SisuSwapVMRouter'];
func.dependencies = [];
