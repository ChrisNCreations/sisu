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

const ONE = 10n ** 9n;

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

  function takerDataExactOut(taker: string, isAToB: boolean) {
    return TakerTraitsLib.build({
      taker,
      isExactIn: false,
      isAToB,
      threshold: 0n,
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

  it("settles an exact-out swap and charges the fee on top of the XYC input", async function () {
    const { maker, taker, eth, usdc, tokenA, tokenB, aqua, sisuStrategy, swapVM, aggregator } =
      await loadFixture(setup);

    const { orderStruct, ethIsA } = await buildAndShip(
      sisuStrategy, aqua, swapVM, maker, tokenA, tokenB, eth, aggregator, ether("1"), ether("3000")
    );

    const strategyHash = await swapVM.hash(orderStruct);
    const [balA, balB] = await aqua.safeBalances(
      await maker.getAddress(),
      await swapVM.getAddress(),
      strategyHash,
      await tokenA.getAddress(),
      await tokenB.getAddress()
    );
    const balanceIn = ethIsA ? balA : balB;
    const balanceOut = ethIsA ? balB : balA;

    // Buy an exact 142 USDC with ETH; the fee book is still balanced so the fee is baseFee.
    const amountOut = ether("142");
    const amountOutSide = balanceOut - amountOut;
    const xycAmountIn = (amountOut * balanceIn + amountOutSide - 1n) / amountOutSide;

    const takerAddr = await taker.getAddress();
    const traits = takerDataExactOut(takerAddr, ethIsA);
    const [quotedIn, quotedOut] = await swapVM.quote.staticCall(orderStruct, amountOut, traits);

    expect(quotedOut).to.equal(amountOut);
    expect(quotedIn).to.be.gt(xycAmountIn); // SisuFee grosses the input up to cover the fee
    const fee = quotedIn - xycAmountIn;
    expect(fee).to.be.gte(xycAmountIn * BASE_FEE / ONE / 2n);
    expect(fee).to.be.lte(xycAmountIn * MAX_FEE / ONE);

    const ethBefore = await eth.balanceOf(takerAddr);
    const usdcBefore = await usdc.balanceOf(takerAddr);
    await (await swapVM.connect(taker).swap(orderStruct, amountOut, traits)).wait();

    expect(await usdc.balanceOf(takerAddr)).to.equal(usdcBefore + amountOut);
    expect(await eth.balanceOf(takerAddr)).to.equal(ethBefore - quotedIn);
  });

  it("charges a repairing swap a lower fee than a worsening swap", async function () {
    const { maker, taker, eth, usdc, tokenA, tokenB, aqua, sisuStrategy, swapVM, aggregator } =
      await loadFixture(setup);

    const { orderStruct, ethIsA } = await buildAndShip(
      sisuStrategy, aqua, swapVM, maker, tokenA, tokenB, eth, aggregator, ether("1"), ether("3000")
    );
    const makerAddr = await maker.getAddress();
    const takerAddr = await taker.getAddress();
    const swapVMAddr = await swapVM.getAddress();
    const tokenAAddr = await tokenA.getAddress();
    const tokenBAddr = await tokenB.getAddress();

    // ETH in makes the ETH side overweight by value, so ETH-in worsens and USDC-in repairs.
    await swapVM.connect(taker).swap(orderStruct, ether("0.2"), takerData(takerAddr, ethIsA, 0n));

    // Mirror the fee book's live balances into a zero-fee control book at the same state.
    const feeHash = await swapVM.hash(orderStruct);
    const [balA, balB] = await aqua.safeBalances(makerAddr, swapVMAddr, feeHash, tokenAAddr, tokenBAddr);
    const controlOrder = await sisuStrategy.buildProgram(
      makerAddr,
      tokenAAddr,
      tokenBAddr,
      await aggregator.getAddress(),
      await eth.getAddress(),
      MAX_STALENESS,
      MAX_RISK,
      0n, // baseFee
      0n, // maxFee
      0n, // rebalanceStrength, so the fee is always zero
      2n, // salt keeps the control hash distinct
      0
    );
    const controlStruct = { maker: controlOrder.maker, traits: controlOrder.traits, data: controlOrder.data };
    await aqua.connect(maker).ship(
      swapVMAddr,
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address maker, uint256 traits, bytes data)"],
        [controlStruct]
      ),
      [tokenAAddr, tokenBAddr],
      [balA, balB]
    );

    // The control's exact-out input is the raw XYC input, so the gap is the Sisu fee in 1e9 bps.
    async function impliedFeeBps(isAToB: boolean, amountOut: bigint) {
      const traits = takerDataExactOut(takerAddr, isAToB);
      const [inFee] = await swapVM.quote.staticCall(orderStruct, amountOut, traits);
      const [inControl] = await swapVM.quote.staticCall(controlStruct, amountOut, traits);
      return (inFee * ONE) / inControl - ONE;
    }

    const worsening = await impliedFeeBps(ethIsA, ether("100"));
    const repairing = await impliedFeeBps(!ethIsA, ether("0.05"));

    expect(worsening).to.be.gt(BASE_FEE);
    expect(repairing).to.be.lt(BASE_FEE);
    expect(repairing).to.be.lt(worsening);
  });

  it("docks a strategy so it no longer fills", async function () {
    const { maker, tokenA, tokenB, aqua, sisuStrategy, swapVM, eth, aggregator } =
      await loadFixture(setup);

    const { orderStruct } = await buildAndShip(
      sisuStrategy, aqua, swapVM, maker, tokenA, tokenB, eth, aggregator, ether("1"), ether("3000")
    );
    const strategyHash = await swapVM.hash(orderStruct);

    await aqua.connect(maker).dock(
      await swapVM.getAddress(),
      strategyHash,
      [await tokenA.getAddress(), await tokenB.getAddress()]
    );

    await expect(
      aqua.safeBalances(
        await maker.getAddress(),
        await swapVM.getAddress(),
        strategyHash,
        await tokenA.getAddress(),
        await tokenB.getAddress()
      )
    ).to.be.revertedWithCustomError(aqua, "SafeBalancesForTokenNotInActiveStrategy");
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
