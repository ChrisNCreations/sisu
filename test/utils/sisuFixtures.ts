import { deployContract } from "@1inch/solidity-utils";
import "@nomicfoundation/hardhat-ethers";
import { Signer } from "ethers";

import { Aqua } from "../../typechain-types/@1inch/aqua/src/Aqua";
import { MockTaker } from "../../typechain-types/contracts/MockTaker";
import { TokenMock } from "../../typechain-types/@1inch/solidity-utils/contracts/mocks/TokenMock";
import { WETHMock } from "../../typechain-types/@1inch/swap-vm/test/mocks/WETHMock";
import { SisuStrategy } from "../../typechain-types/contracts/strategy/SisuStrategy";
import { SisuSwapVMRouter } from "../../typechain-types/contracts/routers/SisuSwapVMRouter";
import { MockAggregatorV3 } from "../../typechain-types/contracts/mocks/MockAggregatorV3";

const { ethers } = require("hardhat");

export const ONE = 10n ** 9n;
export const MAX_RISK = 6n * 10n ** 8n; // 60%
export const BASE_FEE = 3n * 10n ** 6n; // 30 bps
export const MAX_FEE = 1n * 10n ** 7n; // 100 bps
export const STRENGTH = ONE;
export const MAX_STALENESS = 3600;
export const ETH_USD = 3000n * 10n ** 8n;

export async function deploySisuFixture() {
  const [owner, maker, taker, feeReceiver]: Signer[] = await ethers.getSigners();

  const aqua = await deployContract("Aqua") as unknown as Aqua;
  const sisuStrategy = await deployContract("SisuStrategy", [await aqua.getAddress()]) as unknown as SisuStrategy;
  const weth = await deployContract("WETHMock") as unknown as WETHMock;
  const swapVM = await deployContract("SisuSwapVMRouter", [
    await aqua.getAddress(),
    await weth.getAddress(),
    await owner.getAddress(),
    "SisuSwapVM",
    "1.0.0"
  ]) as unknown as SisuSwapVMRouter;
  const mockTaker = await deployContract("MockTaker", [
    await aqua.getAddress(),
    await swapVM.getAddress(),
    await owner.getAddress()
  ]) as unknown as MockTaker;

  const aggregator = await deployContract("MockAggregatorV3", [8, ETH_USD]) as unknown as MockAggregatorV3;

  const eth = await deployContract("TokenMock", ["ETH", "ETH"]) as unknown as TokenMock;
  const usdc = await deployContract("TokenMock", ["USDC", "USDC"]) as unknown as TokenMock;
  let tokenA = eth;
  let tokenB = usdc;
  if ((await tokenA.getAddress()).toLowerCase() > (await tokenB.getAddress()).toLowerCase()) {
    [tokenA, tokenB] = [tokenB, tokenA];
  }

  return {
    accounts: { owner, maker, taker, feeReceiver },
    tokens: { tokenA, tokenB, eth, usdc },
    contracts: { aqua, sisuStrategy, swapVM, mockTaker, weth, aggregator }
  };
}
