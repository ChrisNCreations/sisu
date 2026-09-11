// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1

import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import 'hardhat-deploy';

// Sisu product deploy path. Template AquaAMM path stays in deploy-aqua.ts.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log('Deploying Sisu stack with account:', deployer);

  const aquaDeploy = await deploy('Aqua', {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  const strategyDeploy = await deploy('SisuStrategy', {
    from: deployer,
    args: [aquaDeploy.address],
    log: true,
    waitConfirmations: 1,
  });

  const wethDeploy = await deploy('WETHMock', {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  const routerArgs = [
    aquaDeploy.address,
    wethDeploy.address,
    deployer,
    'SisuSwapVM',
    '1.0.0',
  ];
  const routerDeploy = await deploy('SisuSwapVMRouter', {
    from: deployer,
    args: routerArgs,
    log: true,
    waitConfirmations: 1,
  });

  const ethDeploy = await deploy('SisuETH', {
    contract: 'TokenMock',
    from: deployer,
    args: ['ETH', 'ETH'],
    log: true,
    waitConfirmations: 1,
  });

  const usdcDeploy = await deploy('SisuUSDC', {
    contract: 'TokenMock',
    from: deployer,
    args: ['USDC', 'USDC'],
    log: true,
    waitConfirmations: 1,
  });

  // Local ETH/USD mark: 3000e8, 8 decimals. Matches sisuFixtures ETH_USD.
  const aggregatorDeploy = await deploy('SisuAggregator', {
    contract: 'MockAggregatorV3',
    from: deployer,
    args: [8, 3000n * 10n ** 8n],
    log: true,
    waitConfirmations: 1,
  });

  console.log('\n=== Sisu Deployment Summary ===');
  console.log(`Aqua: ${aquaDeploy.address}`);
  console.log(`SisuStrategy: ${strategyDeploy.address}`);
  console.log(`SisuSwapVMRouter: ${routerDeploy.address}`);
  console.log(`WETH: ${wethDeploy.address}`);
  console.log(`ETH: ${ethDeploy.address}`);
  console.log(`USDC: ${usdcDeploy.address}`);
  console.log(`Aggregator: ${aggregatorDeploy.address}`);
  console.log('===============================\n');
};

export default func;
func.tags = ['Sisu', 'SisuStrategy', 'SisuSwapVMRouter'];
func.dependencies = [];
