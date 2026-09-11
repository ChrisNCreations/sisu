import hre, { ethers } from "hardhat";
import { deployContract } from "@1inch/solidity-utils";
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

// Seeds a node so Swap works before anyone uses Create.
// Local: npx hardhat node (terminal 1), then:
//   npx hardhat run scripts/setup-ui.ts --network localhost
// Public demo (BuildBear): set BUILDBEAR_RPC_URL + PRIVATE_KEY in .env, then:
//   npx hardhat run scripts/setup-ui.ts --network buildbear
async function main() {
  const signers = await ethers.getSigners();
  const owner = signers[0];
  // Single-key networks (BuildBear): maker and trader fall back to the owner.
  const maker = signers[1] ?? owner;
  const trader = signers[2] ?? owner;
  const makerAddr = await maker.getAddress();
  const traderAddr = await trader.getAddress();

  const aqua = await deployContract("Aqua");
  const sisuStrategy = await deployContract("SisuStrategy", [
    await aqua.getAddress(),
  ]);
  const weth = await deployContract("WETHMock");
  const swapVM = await deployContract("SisuSwapVMRouter", [
    await aqua.getAddress(),
    await weth.getAddress(),
    await owner.getAddress(),
    "SisuSwapVM",
    "1.0.0",
  ]);
  const aggregator = await deployContract("MockAggregatorV3", [8, ETH_USD]);
  const eth = await deployContract("TokenMock", ["ETH", "ETH"]);
  const usdc = await deployContract("TokenMock", ["USDC", "USDC"]);

  let tokenA = eth;
  let tokenB = usdc;
  if (
    (await tokenA.getAddress()).toLowerCase() >
    (await tokenB.getAddress()).toLowerCase()
  ) {
    [tokenA, tokenB] = [tokenB, tokenA];
  }
  const ethIsA =
    (await eth.getAddress()).toLowerCase() ===
    (await tokenA.getAddress()).toLowerCase();

  // Fund maker + trader (maker ships, trader swaps).
  // Every broadcast is mined before the next: public RPCs serve stale
  // nonces under rapid sends ("replacement transaction underpriced").
  for (const acct of [maker, trader]) {
    const addr = await acct.getAddress();
    await (await eth.mint(addr, ethers.parseEther("100"))).wait();
    await (await usdc.mint(addr, ethers.parseEther("400000"))).wait();
  }
  // Native gas for distinct trader accounts (BuildBear faucet funds owner only).
  if (traderAddr.toLowerCase() !== (await owner.getAddress()).toLowerCase()) {
    await (
      await owner.sendTransaction({
        to: traderAddr,
        value: ethers.parseEther("1"),
      })
    ).wait();
  }
  await (await eth.connect(maker).approve(await aqua.getAddress(), ethers.MaxUint256)).wait();
  await (await usdc.connect(maker).approve(await aqua.getAddress(), ethers.MaxUint256)).wait();
  await (await eth.connect(trader).approve(await swapVM.getAddress(), ethers.MaxUint256)).wait();
  await (await usdc.connect(trader).approve(await swapVM.getAddress(), ethers.MaxUint256)).wait();

  // Ship one 50/50 book: 1 ETH + 3000 USDC at $3000 mark.
  const liquidityEth = ethers.parseEther("1");
  const liquidityUsdc = ethers.parseEther("3000");
  const order = await sisuStrategy.buildProgram(
    makerAddr,
    await tokenA.getAddress(),
    await tokenB.getAddress(),
    await aggregator.getAddress(),
    await eth.getAddress(),
    MAX_STALENESS,
    MAX_RISK,
    BASE_FEE,
    MAX_FEE,
    STRENGTH,
    1n,
    0,
  );
  const orderStruct = {
    maker: order.maker,
    traits: order.traits,
    data: order.data,
  };
  const amountA = ethIsA ? liquidityEth : liquidityUsdc;
  const amountB = ethIsA ? liquidityUsdc : liquidityEth;
  const shipTx = await aqua.connect(maker).ship(
    await swapVM.getAddress(),
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(address maker, uint256 traits, bytes data)"],
      [orderStruct],
    ),
    [await tokenA.getAddress(), await tokenB.getAddress()],
    [amountA, amountB],
  );
  await shipTx.wait();
  const orderHash: string = await swapVM.hash(orderStruct);

  const deployment = {
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    rpcUrl: (hre.network.config as { url?: string }).url ?? "",
    aqua: await aqua.getAddress(),
    sisuStrategy: await sisuStrategy.getAddress(),
    swapVM: await swapVM.getAddress(),
    weth: await weth.getAddress(),
    eth: await eth.getAddress(),
    usdc: await usdc.getAddress(),
    tokenA: await tokenA.getAddress(),
    tokenB: await tokenB.getAddress(),
    ethIsA,
    aggregator: await aggregator.getAddress(),
    ethToken: await eth.getAddress(),
    maxStaleness: MAX_STALENESS,
    maxRisk: MAX_RISK.toString(),
    baseFee: BASE_FEE.toString(),
    maxFee: MAX_FEE.toString(),
    rebalanceStrength: STRENGTH.toString(),
    maker: makerAddr,
    trader: traderAddr,
    order: {
      maker: orderStruct.maker,
      traits: orderStruct.traits.toString(),
      data: orderStruct.data,
    },
    orderHash,
  };

  const outPath = path.join(__dirname, "../web/lib/deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`Seeded maker ${makerAddr}, trader ${traderAddr}`);
  console.log(`Strategy ${orderHash} shipped. Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
