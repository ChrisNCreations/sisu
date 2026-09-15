import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { deployContract } from '@1inch/solidity-utils';
import * as fs from 'fs';
import * as path from 'path';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import { MANIFEST_VERSION, validateManifest, type DeploymentManifest } from '../deploy/manifest';
import { SISU_STRATEGY_DEFAULTS, resolveExternalAssets } from '../deploy/sisuConfig';
import { validateDeployment } from '../deploy/validate';
import { SisuConfigError } from '../deploy/env';
import deploySisu from '../deploy/deploy-sisu';
import { deploySisuFixture } from './utils/sisuFixtures';

const ENV_KEYS = [
  'SISU_WETH_ADDRESS',
  'SISU_USDC_ADDRESS',
  'SISU_ORACLE_ADDRESS',
  'SISU_WETH_DECIMALS',
  'SISU_USDC_DECIMALS',
  'SISU_ORACLE_DECIMALS',
  'SISU_ORACLE_MAX_STALENESS',
  'SISU_ORACLE_HEARTBEAT',
  'SISU_ALLOW_LIVE_DEPLOYMENT',
];

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

function validManifest(overrides: Partial<DeploymentManifest> = {}): DeploymentManifest {
  const ZERO = '0x0000000000000000000000000000000000000000';
  const TOKEN = '0x00000000000000000000000000000000000000aa';
  return {
    manifestVersion: MANIFEST_VERSION,
    network: 'sepolia',
    chainId: 11155111,
    rpcUrl: 'https://example.invalid',
    explorerBaseUrl: 'https://sepolia.etherscan.io',
    deploymentBlock: 10,
    owner: TOKEN,
    aqua: TOKEN,
    sisuStrategy: TOKEN,
    swapVM: TOKEN,
    weth: TOKEN,
    eth: TOKEN,
    usdc: TOKEN,
    ethToken: TOKEN,
    aggregator: TOKEN,
    tokens: {
      eth: { address: TOKEN, symbol: 'WETH', decimals: 18 },
      usdc: { address: TOKEN, symbol: 'USDC', decimals: 6 },
    },
    oracle: { address: TOKEN, decimals: 8, heartbeat: 86400, maxStaleness: 86400 },
    strategy: {
      maxRisk: '600000000',
      baseFee: '3000000',
      maxFee: '10000000',
      rebalanceStrength: '1000000000',
      maxStaleness: 86400,
      salt: '1',
      deadline: 0,
    },
    ...overrides,
  } as DeploymentManifest;
}

describe('Sisu deployment', () => {
  describe('manifest schema', () => {
    it('accepts a well-formed manifest', () => {
      expect(validateManifest(validManifest())).to.deep.equal([]);
    });

    it('rejects a missing manifestVersion', () => {
      const { manifestVersion, ...rest } = validManifest();
      void manifestVersion;
      expect(validateManifest(rest)).to.include('manifestVersion must be an integer');
    });

    it('rejects an unsupported manifestVersion', () => {
      expect(validateManifest(validManifest({ manifestVersion: MANIFEST_VERSION + 1 }))).to.include(
        `manifestVersion ${MANIFEST_VERSION + 1} is not supported (expected ${MANIFEST_VERSION})`,
      );
    });

    it('rejects the zero address', () => {
      const problems = validateManifest(validManifest({ aqua: '0x0000000000000000000000000000000000000000' }));
      expect(problems).to.include('aqua must not be the zero address');
    });

    it('rejects a fee above the 1e9 cap', () => {
      const manifest = validManifest();
      manifest.strategy.maxFee = '1000000001';
      expect(validateManifest(manifest).join(' ')).to.contain('strategy.maxFee must be between');
    });

    it('rejects baseFee above maxFee', () => {
      const manifest = validManifest();
      manifest.strategy.baseFee = '20000000';
      expect(validateManifest(manifest)).to.include('strategy.baseFee must not exceed strategy.maxFee');
    });

    it('rejects token decimals above 18', () => {
      const manifest = validManifest();
      manifest.tokens.usdc.decimals = 19;
      expect(validateManifest(manifest)).to.include('tokens.usdc.decimals must be an integer between 0 and 18');
    });

    it('rejects an empty object', () => {
      expect(validateManifest({}).length).to.be.greaterThan(0);
    });
  });

  describe('external asset configuration', () => {
    let env: Record<string, string | undefined>;

    beforeEach(() => {
      env = snapshotEnv();
    });

    afterEach(() => {
      restoreEnv(env);
    });

    async function deployAssets(): Promise<{ weth: string; usdc: string; oracle: string }> {
      const weth = await deployContract('TokenMock', ['WETH', 'WETH']);
      const usdc = await deployContract('TokenCustomDecimalsMock', ['USDC', 'USDC', 0, 6]);
      const oracle = await deployContract('MockAggregatorV3', [8, 3000n * 10n ** 8n]);
      return {
        weth: await weth.getAddress(),
        usdc: await usdc.getAddress(),
        oracle: await oracle.getAddress(),
      };
    }

    it('fails clearly when required addresses are missing', async () => {
      delete process.env.SISU_WETH_ADDRESS;
      delete process.env.SISU_USDC_ADDRESS;
      delete process.env.SISU_ORACLE_ADDRESS;
      await expect(resolveExternalAssets(ethers.provider, 11155111)).to.be.rejectedWith(
        SisuConfigError,
        /SISU_WETH_ADDRESS/,
      );
    });

    it('rejects the zero address', async () => {
      const { usdc, oracle } = await deployAssets();
      process.env.SISU_WETH_ADDRESS = '0x0000000000000000000000000000000000000000';
      process.env.SISU_USDC_ADDRESS = usdc;
      process.env.SISU_ORACLE_ADDRESS = oracle;
      await expect(resolveExternalAssets(ethers.provider, 11155111)).to.be.rejectedWith(
        /must not be the zero address/,
      );
    });

    it('rejects an address with no bytecode', async () => {
      const { usdc, oracle } = await deployAssets();
      process.env.SISU_WETH_ADDRESS = '0x00000000000000000000000000000000000000aa';
      process.env.SISU_USDC_ADDRESS = usdc;
      process.env.SISU_ORACLE_ADDRESS = oracle;
      await expect(resolveExternalAssets(ethers.provider, 11155111)).to.be.rejectedWith(
        /no contract bytecode/,
      );
    });

    it('rejects a non-18-decimal ETH leg', async () => {
      const notWeth = await deployContract('TokenCustomDecimalsMock', ['BAD', 'BAD', 0, 6]);
      const { usdc, oracle } = await deployAssets();
      process.env.SISU_WETH_ADDRESS = await notWeth.getAddress();
      process.env.SISU_USDC_ADDRESS = usdc;
      process.env.SISU_ORACLE_ADDRESS = oracle;
      await expect(resolveExternalAssets(ethers.provider, 11155111)).to.be.rejectedWith(
        /the ETH leg must be 18/,
      );
    });

    it('rejects a stale oracle', async () => {
      const { weth, usdc, oracle } = await deployAssets();
      process.env.SISU_WETH_ADDRESS = weth;
      process.env.SISU_USDC_ADDRESS = usdc;
      process.env.SISU_ORACLE_ADDRESS = oracle;
      process.env.SISU_ORACLE_MAX_STALENESS = '3600';

      const block = await ethers.provider.getBlock('latest');
      const staleAt = BigInt(block!.timestamp) - 4000n;
      const feed = await ethers.getContractAt('MockAggregatorV3', oracle);
      await (await feed.setRound(1, 3000n * 10n ** 8n, staleAt, staleAt, 1)).wait();

      await expect(resolveExternalAssets(ethers.provider, 11155111)).to.be.rejectedWith(/is stale/);
    });

    it('rejects a non-positive oracle answer', async () => {
      const { weth, usdc, oracle } = await deployAssets();
      process.env.SISU_WETH_ADDRESS = weth;
      process.env.SISU_USDC_ADDRESS = usdc;
      process.env.SISU_ORACLE_ADDRESS = oracle;
      const feed = await ethers.getContractAt('MockAggregatorV3', oracle);
      await (await feed.setAnswer(0)).wait();
      await expect(resolveExternalAssets(ethers.provider, 11155111)).to.be.rejectedWith(/non-positive/);
    });

    it('rejects a future oracle timestamp', async () => {
      const { weth, usdc, oracle } = await deployAssets();
      process.env.SISU_WETH_ADDRESS = weth;
      process.env.SISU_USDC_ADDRESS = usdc;
      process.env.SISU_ORACLE_ADDRESS = oracle;

      const block = await ethers.provider.getBlock('latest');
      const futureAt = BigInt(block!.timestamp) + 4000n;
      const feed = await ethers.getContractAt('MockAggregatorV3', oracle);
      await (await feed.setRound(1, 3000n * 10n ** 8n, futureAt, futureAt, 1)).wait();

      await expect(resolveExternalAssets(ethers.provider, 11155111)).to.be.rejectedWith(/future update timestamp/);
    });

    it('rejects a pinned decimals mismatch', async () => {
      const { weth, usdc, oracle } = await deployAssets();
      process.env.SISU_WETH_ADDRESS = weth;
      process.env.SISU_USDC_ADDRESS = usdc;
      process.env.SISU_ORACLE_ADDRESS = oracle;
      process.env.SISU_USDC_DECIMALS = '18';
      await expect(resolveExternalAssets(ethers.provider, 11155111)).to.be.rejectedWith(
        /SISU_USDC_DECIMALS=18 does not match/,
      );
    });

    it('resolves valid assets', async () => {
      const { weth, usdc, oracle } = await deployAssets();
      process.env.SISU_WETH_ADDRESS = weth;
      process.env.SISU_USDC_ADDRESS = usdc;
      process.env.SISU_ORACLE_ADDRESS = oracle;

      const assets = await resolveExternalAssets(ethers.provider, 11155111);
      expect(assets.weth).to.equal(weth);
      expect(assets.wethDecimals).to.equal(18);
      expect(assets.usdc).to.equal(usdc);
      expect(assets.usdcDecimals).to.equal(6);
      expect(assets.oracle).to.equal(oracle);
      expect(assets.oracleDecimals).to.equal(8);
      expect(assets.maxStaleness).to.equal(SISU_STRATEGY_DEFAULTS.maxStaleness);
    });
  });

  describe('post-deployment validation', () => {
    it('passes for a correctly deployed local stack', async () => {
      const { accounts, tokens, contracts } = await deploySisuFixture();
      const [ethAddr, usdcAddr] = [tokens.eth, tokens.usdc];
      const manifest = validManifest({
        network: 'hardhat',
        chainId: 31337,
        rpcUrl: 'http://127.0.0.1:8545',
        explorerBaseUrl: null,
        owner: await accounts.owner.getAddress(),
        aqua: await contracts.aqua.getAddress(),
        sisuStrategy: await contracts.sisuStrategy.getAddress(),
        swapVM: await contracts.swapVM.getAddress(),
        weth: await contracts.weth.getAddress(),
        eth: await ethAddr.getAddress(),
        usdc: await usdcAddr.getAddress(),
        ethToken: await ethAddr.getAddress(),
        aggregator: await contracts.aggregator.getAddress(),
        tokens: {
          eth: { address: await ethAddr.getAddress(), symbol: 'ETH', decimals: 18 },
          usdc: { address: await usdcAddr.getAddress(), symbol: 'USDC', decimals: 18 },
        },
        oracle: {
          address: await contracts.aggregator.getAddress(),
          decimals: 8,
          heartbeat: 3600,
          maxStaleness: 3600,
        },
      });

      const result = await validateDeployment({ provider: ethers.provider, manifest });
      expect(result.errors).to.deep.equal([]);
    });

    it('catches mis-wired deployments', async () => {
      const { accounts, tokens, contracts } = await deploySisuFixture();
      const manifest = validManifest({
        network: 'hardhat',
        chainId: 31337,
        rpcUrl: 'http://127.0.0.1:8545',
        explorerBaseUrl: null,
        owner: await accounts.owner.getAddress(),
        // Wrong Aqua: point at the strategy contract instead.
        aqua: await contracts.sisuStrategy.getAddress(),
        sisuStrategy: await contracts.sisuStrategy.getAddress(),
        swapVM: await contracts.swapVM.getAddress(),
        weth: await contracts.weth.getAddress(),
        eth: await tokens.eth.getAddress(),
        usdc: await tokens.usdc.getAddress(),
        ethToken: await tokens.eth.getAddress(),
        aggregator: await contracts.aggregator.getAddress(),
        tokens: {
          eth: { address: await tokens.eth.getAddress(), symbol: 'ETH', decimals: 18 },
          usdc: { address: await tokens.usdc.getAddress(), symbol: 'USDC', decimals: 18 },
        },
        oracle: {
          address: await contracts.aggregator.getAddress(),
          decimals: 8,
          heartbeat: 3600,
          maxStaleness: 3600,
        },
      });

      const result = await validateDeployment({ provider: ethers.provider, manifest });
      expect(result.errors.join(' ')).to.contain('router AQUA()');
    });
  });

  describe('deploy path', () => {
    let env: Record<string, string | undefined>;

    beforeEach(() => {
      env = snapshotEnv();
    });

    afterEach(() => {
      restoreEnv(env);
    });

    it('deploys the local mock stack and writes a versioned manifest', async () => {
      // Hardhat's in-process chain is brand new each run; clear stale records so
      // hardhat-deploy does not try to reuse an address from a previous chain.
      fs.rmSync(path.join(__dirname, '..', 'deployments', 'hardhat'), { recursive: true, force: true });
      fs.rmSync(path.join(__dirname, '..', 'deployments', 'sisu-hardhat.json'), { force: true });

      await deploySisu(hre);

      const manifestPath = path.join(__dirname, '..', 'deployments', 'sisu-hardhat.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as DeploymentManifest;

      expect(validateManifest(manifest)).to.deep.equal([]);
      // Local mocks: the ETH leg is the SisuETH token, distinct from WETHMock.
      expect(manifest.network).to.equal('hardhat');
      expect(manifest.ethToken).to.equal(manifest.eth);
      expect(manifest.weth).to.not.equal(manifest.eth);
      expect(manifest.tokens.usdc.decimals).to.equal(18);

      const result = await validateDeployment({ provider: ethers.provider, manifest });
      expect(result.errors).to.deep.equal([]);
    });

    it('refuses a public network when external addresses are not configured', async () => {
      delete process.env.SISU_WETH_ADDRESS;
      delete process.env.SISU_USDC_ADDRESS;
      delete process.env.SISU_ORACLE_ADDRESS;
      process.env.SISU_ALLOW_LIVE_DEPLOYMENT = 'true';

      let deployCalls = 0;
      const fakeHre = {
        network: { name: 'sepolia', config: { url: 'https://sepolia.invalid' } },
        ethers: { provider: { getNetwork: async () => ({ chainId: 11155111n }) } },
        getNamedAccounts: async () => ({ deployer: '0x00000000000000000000000000000000000000aa' }),
        deployments: {
          deploy: async () => {
            deployCalls += 1;
            return { address: '0x00000000000000000000000000000000000000bb' };
          },
        },
        run: async () => undefined,
      } as unknown as HardhatRuntimeEnvironment;

      await expect(deploySisu(fakeHre)).to.be.rejectedWith(SisuConfigError, /SISU_WETH_ADDRESS/);
      expect(deployCalls).to.equal(0);
    });

    it('refuses a public network without explicit broadcast opt-in', async () => {
      delete process.env.SISU_ALLOW_LIVE_DEPLOYMENT;
      let deployCalls = 0;

      const fakeHre = {
        network: { name: 'sepolia', config: { url: 'https://sepolia.invalid' } },
        ethers: { provider: { getNetwork: async () => ({ chainId: 11155111n }) } },
        getNamedAccounts: async () => ({ deployer: '0x00000000000000000000000000000000000000aa' }),
        deployments: {
          deploy: async () => {
            deployCalls += 1;
            return { address: '0x00000000000000000000000000000000000000bb' };
          },
        },
        run: async () => undefined,
      } as unknown as HardhatRuntimeEnvironment;

      await expect(deploySisu(fakeHre)).to.be.rejectedWith(SisuConfigError, /SISU_ALLOW_LIVE_DEPLOYMENT=true/);
      expect(deployCalls).to.equal(0);
    });

    it('refuses a Sepolia-labelled network on the wrong chain id', async () => {
      process.env.SISU_ALLOW_LIVE_DEPLOYMENT = 'true';
      const fakeHre = {
        network: { name: 'sepolia', config: { url: 'https://sepolia.invalid' } },
        ethers: { provider: { getNetwork: async () => ({ chainId: 1n }) } },
        getNamedAccounts: async () => ({ deployer: '0x00000000000000000000000000000000000000aa' }),
        deployments: { deploy: async () => ({ address: '0x00000000000000000000000000000000000000bb' }) },
        run: async () => undefined,
      } as unknown as HardhatRuntimeEnvironment;

      await expect(deploySisu(fakeHre)).to.be.rejectedWith(SisuConfigError, /expected 11155111/);
    });
  });
});
