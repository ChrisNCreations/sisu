import "@nomicfoundation/hardhat-chai-matchers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployContract, expect } from "@1inch/solidity-utils";

import { TokenMock } from "../typechain-types/@1inch/solidity-utils/contracts/mocks/TokenMock";
import {
  deploySisuFixture,
  MAX_RISK,
  BASE_FEE,
  MAX_FEE,
  STRENGTH,
  MAX_STALENESS
} from "./utils/sisuFixtures";

const { ethers } = require("hardhat");

const ONE = 10n ** 9n;

type Fixture = Awaited<ReturnType<typeof deploySisuFixture>> & { uni: TokenMock };

interface Overrides {
  maker?: string;
  tokenA?: string;
  tokenB?: string;
  oracle?: string;
  ethToken?: string;
  maxStaleness?: number;
  maxRisk?: bigint;
  baseFee?: bigint;
  maxFee?: bigint;
  rebalanceStrength?: bigint;
  salt?: bigint;
  deadline?: number;
}

// buildProgram is pure, so this is a cheap call rather than a transaction.
async function build(fixture: Fixture, overrides: Overrides = {}) {
  return fixture.contracts.sisuStrategy.buildProgram(
    overrides.maker ?? (await fixture.accounts.maker.getAddress()),
    overrides.tokenA ?? (await fixture.tokens.tokenA.getAddress()),
    overrides.tokenB ?? (await fixture.tokens.tokenB.getAddress()),
    overrides.oracle ?? (await fixture.contracts.aggregator.getAddress()),
    overrides.ethToken ?? (await fixture.tokens.eth.getAddress()),
    overrides.maxStaleness ?? MAX_STALENESS,
    overrides.maxRisk ?? MAX_RISK,
    overrides.baseFee ?? BASE_FEE,
    overrides.maxFee ?? MAX_FEE,
    overrides.rebalanceStrength ?? STRENGTH,
    overrides.salt ?? 1n,
    overrides.deadline ?? 0
  );
}

describe("SisuStrategy.buildProgram policy", function () {
  async function setup(): Promise<Fixture> {
    const fixture = await deploySisuFixture();
    const uni = (await deployContract("TokenMock", ["UNI", "UNI"])) as unknown as TokenMock;
    return { ...fixture, uni };
  }

  it("builds the default ETH/USDC program", async function () {
    const fixture = await loadFixture(setup);
    await expect(build(fixture)).to.not.be.reverted;
  });

  it("accepts the ETH/USDC pair in either order", async function () {
    const fixture = await loadFixture(setup);
    await expect(
      build(fixture, {
        tokenA: await fixture.tokens.usdc.getAddress(),
        tokenB: await fixture.tokens.eth.getAddress()
      })
    ).to.not.be.reverted;
  });

  it("reverts ZeroMaxRisk when maxRisk is zero", async function () {
    const fixture = await loadFixture(setup);
    await expect(build(fixture, { maxRisk: 0n })).to.be.revertedWithCustomError(
      fixture.contracts.sisuStrategy,
      "ZeroMaxRisk"
    );
  });

  it("reverts MaxFeeBelowBaseFee when maxFee is under baseFee", async function () {
    const fixture = await loadFixture(setup);
    await expect(build(fixture, { baseFee: 100n, maxFee: 50n })).to.be.revertedWithCustomError(
      fixture.contracts.sisuStrategy,
      "MaxFeeBelowBaseFee"
    );
  });

  it("reverts MaxFeeAboveBps above 100% so the exact-in fee subtraction cannot underflow", async function () {
    const fixture = await loadFixture(setup);
    await expect(build(fixture, { baseFee: 0n, maxFee: ONE + 1n }))
      .to.be.revertedWithCustomError(fixture.contracts.sisuStrategy, "MaxFeeAboveBps")
      .withArgs(ONE + 1n);
  });

  it("allows maxFee exactly at 100%", async function () {
    const fixture = await loadFixture(setup);
    await expect(build(fixture, { baseFee: 0n, maxFee: ONE })).to.not.be.reverted;
  });

  it("reverts UnsupportedPair when neither leg is the ETH token", async function () {
    const fixture = await loadFixture(setup);
    await expect(
      build(fixture, {
        tokenA: await fixture.tokens.usdc.getAddress(),
        tokenB: await fixture.uni.getAddress()
      })
    ).to.be.revertedWithCustomError(fixture.contracts.sisuStrategy, "UnsupportedPair");
  });

  it("reverts UnsupportedPair when both legs are the ETH token", async function () {
    const fixture = await loadFixture(setup);
    const eth = await fixture.tokens.eth.getAddress();
    await expect(build(fixture, { tokenA: eth, tokenB: eth })).to.be.revertedWithCustomError(
      fixture.contracts.sisuStrategy,
      "UnsupportedPair"
    );
  });
});
