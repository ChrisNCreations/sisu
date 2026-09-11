import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Signer } from "ethers";
import { expect, ether } from "@1inch/solidity-utils";

import { TakerTraitsLib } from "./utils/SwapVMHelpers";
import {
  deploySisuFixture,
  MAX_RISK,
  BASE_FEE,
  MAX_FEE,
  STRENGTH,
  MAX_STALENESS
} from "./utils/sisuFixtures";
import { Aqua } from "../typechain-types/@1inch/aqua/src/Aqua";
import { SisuStrategy } from "../typechain-types/contracts/strategy/SisuStrategy";
import { SisuSwapVMRouter } from "../typechain-types/contracts/routers/SisuSwapVMRouter";
import { TokenMock } from "../typechain-types/@1inch/solidity-utils/contracts/mocks/TokenMock";
import { MockAggregatorV3 } from "../typechain-types/contracts/mocks/MockAggregatorV3";

const { ethers } = require("hardhat");

describe("Sisu Aqua e2e", function () {
  async function setup() {
    const fixture = await deploySisuFixture();
    const { maker, taker } = fixture.accounts;
    const { eth, usdc, tokenA, tokenB } = fixture.tokens;
    const { aqua, sisuStrategy, swapVM, aggregator } = fixture.contracts;

    await eth.mint(await maker.getAddress(), ether("100"));
    await usdc.mint(await maker.getAddress(), ether("400000"));
    await eth.mint(await taker.getAddress(), ether("100"));
    await usdc.mint(await taker.getAddress(), ether("400000"));

    await eth.connect(maker).approve(await aqua.getAddress(), ethers.MaxUint256);
    await usdc.connect(maker).approve(await aqua.getAddress(), ethers.MaxUint256);
    await eth.connect(taker).approve(await swapVM.getAddress(), ethers.MaxUint256);
    await usdc.connect(taker).approve(await swapVM.getAddress(), ethers.MaxUint256);

    return {
      maker,
      taker,
      eth,
      usdc,
      tokenA,
      tokenB,
      aqua,
      sisuStrategy,
      swapVM,
      aggregator
    };
  }

  async function buildAndShip(
    sisuStrategy: SisuStrategy,
    aqua: Aqua,
    swapVM: SisuSwapVMRouter,
    maker: Signer,
    tokenA: TokenMock,
    tokenB: TokenMock,
    eth: TokenMock,
    aggregator: MockAggregatorV3,
    liquidityEth: bigint,
    liquidityUsdc: bigint
  ) {
    const order = await sisuStrategy.buildProgram(
      await maker.getAddress(),
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
      0
    );
    const orderStruct = { maker: order.maker, traits: order.traits, data: order.data };

    const ethIsA = (await eth.getAddress()).toLowerCase() === (await tokenA.getAddress()).toLowerCase();
    const amountA = ethIsA ? liquidityEth : liquidityUsdc;
    const amountB = ethIsA ? liquidityUsdc : liquidityEth;

    await aqua.connect(maker).ship(
      await swapVM.getAddress(),
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address maker, uint256 traits, bytes data)"],
        [orderStruct]
      ),
      [await tokenA.getAddress(), await tokenB.getAddress()],
      [amountA, amountB]
    );

    return { orderStruct, ethIsA };
  }

  function takerData(taker: string, isAToB: boolean, threshold: bigint) {
    return TakerTraitsLib.build({
      taker,
      isExactIn: true,
      isAToB,
      threshold,
      useTransferFromAndAquaPush: true
    });
  }

  it("executes a safe trade that raises risk", async function () {
    const { maker, taker, eth, usdc, tokenA, tokenB, aqua, sisuStrategy, swapVM, aggregator } =
      await loadFixture(setup);

    const { orderStruct, ethIsA } = await buildAndShip(
      sisuStrategy, aqua, swapVM, maker, tokenA, tokenB, eth, aggregator, ether("1"), ether("3000")
    );

    const amountIn = ether("0.05");
    const tx = await swapVM.connect(taker).swap(
      orderStruct,
      amountIn,
      takerData(await taker.getAddress(), ethIsA, 0n)
    );

    await expect(tx).to.changeTokenBalances(
      eth,
      [await taker.getAddress(), await maker.getAddress()],
      [-amountIn, amountIn]
    );
  });

  it("reverts an unsafe trade with SisuRiskLimitExceeded and does not settle", async function () {
    const { maker, taker, eth, usdc, tokenA, tokenB, aqua, sisuStrategy, swapVM, aggregator } =
      await loadFixture(setup);

    const { orderStruct, ethIsA } = await buildAndShip(
      sisuStrategy, aqua, swapVM, maker, tokenA, tokenB, eth, aggregator, ether("1"), ether("3000")
    );

    const makerEthBefore = await eth.balanceOf(await maker.getAddress());
    const takerEthBefore = await eth.balanceOf(await taker.getAddress());

    await expect(
      swapVM.connect(taker).swap(
        orderStruct,
        ether("5"),
        takerData(await taker.getAddress(), ethIsA, 0n)
      )
    ).to.be.revertedWithCustomError(swapVM, "SisuRiskLimitExceeded");

    expect(await eth.balanceOf(await maker.getAddress())).to.equal(makerEthBefore);
    expect(await eth.balanceOf(await taker.getAddress())).to.equal(takerEthBefore);
  });

  it("executes a repairing trade after a safe imbalance", async function () {
    const { maker, taker, eth, usdc, tokenA, tokenB, aqua, sisuStrategy, swapVM, aggregator } =
      await loadFixture(setup);

    const { orderStruct, ethIsA } = await buildAndShip(
      sisuStrategy, aqua, swapVM, maker, tokenA, tokenB, eth, aggregator, ether("1"), ether("3000")
    );

    await swapVM.connect(taker).swap(
      orderStruct,
      ether("0.05"),
      takerData(await taker.getAddress(), ethIsA, 0n)
    );

    const usdcBefore = await usdc.balanceOf(await maker.getAddress());
    await swapVM.connect(taker).swap(
      orderStruct,
      ether("150"),
      takerData(await taker.getAddress(), !ethIsA, 0n)
    );
    expect(await usdc.balanceOf(await maker.getAddress())).to.be.gt(usdcBefore);
  });

  it("reverts on a stale mark", async function () {
    const { maker, taker, eth, tokenA, tokenB, aqua, sisuStrategy, swapVM, aggregator } =
      await loadFixture(setup);

    const { orderStruct, ethIsA } = await buildAndShip(
      sisuStrategy, aqua, swapVM, maker, tokenA, tokenB, eth, aggregator, ether("1"), ether("3000")
    );

    await aggregator.setRound(2, 3000n * 10n ** 8n, 1, 1, 2);

    await expect(
      swapVM.connect(taker).swap(
        orderStruct,
        ether("0.01"),
        takerData(await taker.getAddress(), ethIsA, 0n)
      )
    ).to.be.revertedWithCustomError(swapVM, "SisuStaleOracle");
  });
});
