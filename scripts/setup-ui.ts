import hre, { ethers } from "hardhat";
import { Contract, Wallet, type Signer } from "ethers";
import * as fs from "fs";
import * as path from "path";

import {
  MAX_RISK,
  BASE_FEE,
  MAX_FEE,
  STRENGTH,
  MAX_STALENESS,
  ETH_USD,
} from "../test/utils/sisuFixtures";

import {
  MANIFEST_VERSION,
  type DeploymentManifest,
} from "../deploy/manifest";
import {
  SEPOLIA_CHAIN_ID,
  isLocalNetwork,
  requireLiveDeploymentConfirmation,
  requireEnv,
  SisuConfigError,
} from "../deploy/env";
import { resolveExternalAssets } from "../deploy/sisuConfig";

const WETH_ABI = [
  "function deposit() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];
const AQUA_ABI = [
  "function ship(address app, bytes strategy, address[] tokens, uint256[] amounts) returns (bytes32)",
];
const ROUTER_ABI = ["function hash((address maker,uint256 traits,bytes data)) view returns (bytes32)"];

type Order = { maker: string; traits: bigint; data: string };

function sortedTokens(first: string, second: string): [string, string, boolean] {
  const firstIsA = first.toLowerCase() < second.toLowerCase();
  return firstIsA ? [first, second, true] : [second, first, false];
}

function manifestPath(): string {
  return path.join(__dirname, "../web/lib/deployment.json");
}

async function writeManifest(values: DeploymentManifest): Promise<void> {
  fs.writeFileSync(manifestPath(), JSON.stringify(values, null, 2));
}

async function buildAndShip(options: {
  owner: Signer;
  maker: Signer;
  trader: Signer;
  aqua: Contract;
  strategy: Contract;
  router: Contract;
  weth: string;
  eth: string;
  usdc: string;
  oracle: string;
  ethSymbol: string;
  ethDecimals: number;
  usdcSymbol: string;
  usdcDecimals: number;
  oracleDecimals: number;
  oracleHeartbeat: number;
  maxStaleness: number;
  chainId: number;
  rpcUrl: string;
  network: string;
  explorerBaseUrl: string | null;
}): Promise<DeploymentManifest> {
  const {
    owner,
    maker,
    trader,
    aqua,
    strategy,
    router,
    weth,
    eth,
    usdc,
    oracle,
    ethSymbol,
    ethDecimals,
    usdcSymbol,
    usdcDecimals,
    oracleDecimals,
    oracleHeartbeat,
    maxStaleness,
    chainId,
    rpcUrl,
    network,
    explorerBaseUrl,
  } = options;
  const makerAddress = await maker.getAddress();
  const traderAddress = await trader.getAddress();
  const [tokenA, tokenB, ethIsA] = sortedTokens(eth, usdc);

  if (network === "sepolia" && makerAddress.toLowerCase() === traderAddress.toLowerCase()) {
    throw new SisuConfigError(
      "Sepolia seed requires distinct maker and trader wallets. Set SISU_MAKER_PRIVATE_KEY and SISU_TRADER_PRIVATE_KEY.",
    );
  }

  const ethToken = eth;
  if (network === "sepolia") {
    const wrapped = new Contract(weth, WETH_ABI, maker);
    const wrapAmount = ethers.parseEther("1");
    if ((await wrapped.balanceOf(makerAddress)) < wrapAmount) {
      await (await wrapped.deposit({ value: wrapAmount })).wait();
    }
  }

  const makerEth = new Contract(eth, ERC20_ABI, maker);
  const makerUsdc = new Contract(usdc, ERC20_ABI, maker);
  const traderEth = new Contract(eth, ERC20_ABI, trader);
  const traderUsdc = new Contract(usdc, ERC20_ABI, trader);
  await (await makerEth.approve(await aqua.getAddress(), ethers.MaxUint256)).wait();
  await (await makerUsdc.approve(await aqua.getAddress(), ethers.MaxUint256)).wait();
  await (await traderEth.approve(await router.getAddress(), ethers.MaxUint256)).wait();
  await (await traderUsdc.approve(await router.getAddress(), ethers.MaxUint256)).wait();

  const orderResult = await strategy.buildProgram(
    makerAddress,
    tokenA,
    tokenB,
    oracle,
    ethToken,
    maxStaleness,
    MAX_RISK,
    BASE_FEE,
    MAX_FEE,
    STRENGTH,
    1n,
    0,
  );
  const order: Order = {
    maker: orderResult.maker,
    traits: BigInt(orderResult.traits),
    data: orderResult.data,
  };
  const liquidityEth = ethers.parseEther("1");
  const liquidityUsdc = ethers.parseUnits("3000", usdcDecimals);
  const amountA = ethIsA ? liquidityEth : liquidityUsdc;
  const amountB = ethIsA ? liquidityUsdc : liquidityEth;
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(address maker, uint256 traits, bytes data)"],
    [order],
  );
  await (await aqua.connect(maker).ship(
    await router.getAddress(),
    encoded,
    [tokenA, tokenB],
    [amountA, amountB],
  )).wait();
  const orderHash = String(await router.hash(order));

  return {
    manifestVersion: MANIFEST_VERSION,
    network,
    chainId,
    rpcUrl,
    explorerBaseUrl,
    deploymentBlock: await ethers.provider.getBlockNumber(),
    owner: await owner.getAddress(),
    aqua: await aqua.getAddress(),
    sisuStrategy: await strategy.getAddress(),
    swapVM: await router.getAddress(),
    weth,
    eth,
    usdc,
    ethToken,
    aggregator: oracle,
    tokens: {
      eth: { address: eth, symbol: ethSymbol, decimals: ethDecimals },
      usdc: { address: usdc, symbol: usdcSymbol, decimals: usdcDecimals },
    },
    oracle: {
      address: oracle,
      decimals: oracleDecimals,
      heartbeat: oracleHeartbeat,
      maxStaleness,
    },
    strategy: {
      maxRisk: MAX_RISK.toString(),
      baseFee: BASE_FEE.toString(),
      maxFee: MAX_FEE.toString(),
      rebalanceStrength: STRENGTH.toString(),
      maxStaleness,
      salt: "1",
      deadline: 0,
    },
    tokenA,
    tokenB,
    ethIsA,
    maker: makerAddress,
    trader: traderAddress,
    order: { maker: order.maker, traits: order.traits.toString(), data: order.data },
    orderHash,
    // Legacy fields remain for the current web client until its manifest reader is updated.
    maxStaleness,
    maxRisk: MAX_RISK.toString(),
    baseFee: BASE_FEE.toString(),
    maxFee: MAX_FEE.toString(),
    rebalanceStrength: STRENGTH.toString(),
  } as DeploymentManifest & Record<string, unknown>;
}

async function main() {
  const network = hre.network.name;
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const owner = (await ethers.getSigners())[0];
  const local = isLocalNetwork(network);

  requireLiveDeploymentConfirmation(network);
  if (network === "sepolia" && chainId !== SEPOLIA_CHAIN_ID) {
    throw new SisuConfigError(`network sepolia is connected to chain ${chainId}, expected ${SEPOLIA_CHAIN_ID}.`);
  }

  let maker: Signer = owner;
  let trader: Signer = (await ethers.getSigners())[2] ?? owner;
  let aqua: Contract;
  let strategy: Contract;
  let router: Contract;
  let weth: string;
  let eth: string;
  let usdc: string;
  let oracle: string;
  let ethSymbol: string;
  let ethDecimals: number;
  let usdcSymbol: string;
  let usdcDecimals: number;
  let oracleDecimals: number;
  let oracleHeartbeat: number;
  let maxStaleness: number;

  if (local) {
    const { deployContract } = await import("@1inch/solidity-utils");
    aqua = await deployContract("Aqua");
    strategy = await deployContract("SisuStrategy", [await aqua.getAddress()]);
    const wethContract = await deployContract("WETHMock");
    router = await deployContract("SisuSwapVMRouter", [
      await aqua.getAddress(),
      await wethContract.getAddress(),
      await owner.getAddress(),
      "SisuSwapVM",
      "1.0.0",
    ]);
    const oracleContract = await deployContract("MockAggregatorV3", [8, ETH_USD]);
    const ethContract = await deployContract("TokenMock", ["ETH", "ETH"]);
    const usdcContract = await deployContract("TokenMock", ["USDC", "USDC"]);
    weth = await wethContract.getAddress();
    eth = await ethContract.getAddress();
    usdc = await usdcContract.getAddress();
    oracle = await oracleContract.getAddress();
    ethSymbol = "ETH";
    ethDecimals = 18;
    usdcSymbol = "USDC";
    usdcDecimals = 18;
    oracleDecimals = 8;
    oracleHeartbeat = MAX_STALENESS;
    maxStaleness = MAX_STALENESS;
    for (const account of [maker, trader]) {
      const address = await account.getAddress();
      const ethMint = new Contract(eth, ["function mint(address,uint256)"], owner);
      const usdcMint = new Contract(usdc, ["function mint(address,uint256)"], owner);
      await (await ethMint.mint(address, ethers.parseEther("100"))).wait();
      await (await usdcMint.mint(address, ethers.parseEther("400000"))).wait();
    }
  } else {
    const assets = await resolveExternalAssets(ethers.provider, chainId);
    const makerKey = requireEnv("SISU_MAKER_PRIVATE_KEY");
    const traderKey = requireEnv("SISU_TRADER_PRIVATE_KEY");
    maker = new Wallet(makerKey, ethers.provider);
    trader = new Wallet(traderKey, ethers.provider);
    const deployments = hre.deployments;
    aqua = new Contract((await deployments.get("Aqua")).address, AQUA_ABI, owner);
    strategy = await ethers.getContractAt("SisuStrategy", (await deployments.get("SisuStrategy")).address);
    router = new Contract((await deployments.get("SisuSwapVMRouter")).address, ROUTER_ABI, owner);
    weth = assets.weth;
    eth = assets.weth;
    usdc = assets.usdc;
    oracle = assets.oracle;
    ethSymbol = assets.wethSymbol;
    ethDecimals = assets.wethDecimals;
    usdcSymbol = assets.usdcSymbol;
    usdcDecimals = assets.usdcDecimals;
    oracleDecimals = assets.oracleDecimals;
    oracleHeartbeat = assets.oracleHeartbeat;
    maxStaleness = assets.maxStaleness;
  }

  const manifest = await buildAndShip({
    owner,
    maker,
    trader,
    aqua,
    strategy,
    router,
    weth,
    eth,
    usdc,
    oracle,
    ethSymbol,
    ethDecimals,
    usdcSymbol,
    usdcDecimals,
    oracleDecimals,
    oracleHeartbeat,
    maxStaleness,
    chainId,
    rpcUrl: (hre.network.config as { url?: string }).url ?? "",
    network,
    explorerBaseUrl: network === "sepolia" ? "https://sepolia.etherscan.io" : null,
  });
  await writeManifest(manifest);
  console.log(`Seeded maker ${manifest.maker}, trader ${manifest.trader}`);
  console.log(`Strategy ${manifest.orderHash} shipped. Wrote ${manifestPath()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
