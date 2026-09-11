import "@nomicfoundation/hardhat-chai-matchers";
import { expect, ether } from "@1inch/solidity-utils";

const { ethers } = require("hardhat");

const ONE = 10n ** 9n;

describe("SisuRiskMath", function () {
  async function deployHarness() {
    const factory = await ethers.getContractFactory("SisuRiskMathHarness");
    const math = await factory.deploy();
    await math.waitForDeployment();
    return math;
  }

  describe("valueUsd", function () {
    it("values 1 WETH at $3000 with an 8-decimal feed", async function () {
      const math = await deployHarness();
      const amount = ether("1");
      const price = 3000n * 10n ** 8n;
      expect(await math.valueUsd(amount, price, 18, 8)).to.equal(ether("3000"));
    });

    it("values 1 USDC as $1", async function () {
      const math = await deployHarness();
      expect(await math.valueUsdcUsd(10n ** 6n)).to.equal(ether("1"));
    });

    it("reverts on a zero price", async function () {
      const math = await deployHarness();
      await expect(math.valueUsd(ether("1"), 0, 18, 8)).to.be.revertedWithCustomError(
        math,
        "InvalidPrice"
      );
    });
  });

  describe("risk", function () {
    it("is 0 for equal values", async function () {
      const math = await deployHarness();
      expect(await math.risk(ether("100"), ether("100"))).to.equal(0);
    });

    it("is 0 for empty inventory", async function () {
      const math = await deployHarness();
      expect(await math.risk(0, 0)).to.equal(0);
    });

    it("is 1e9 when one side is empty", async function () {
      const math = await deployHarness();
      expect(await math.risk(ether("100"), 0)).to.equal(ONE);
      expect(await math.risk(0, ether("100"))).to.equal(ONE);
    });

    it("is symmetric", async function () {
      const math = await deployHarness();
      const a = ether("70");
      const b = ether("30");
      expect(await math.risk(a, b)).to.equal(await math.risk(b, a));
    });

    it("matches |A-B|/(A+B) at 70/30", async function () {
      const math = await deployHarness();
      // |70-30| / 100 = 40% = 4e8
      expect(await math.risk(ether("70"), ether("30"))).to.equal(4n * 10n ** 8n);
    });

    it("never exceeds 1e9", async function () {
      const math = await deployHarness();
      expect(await math.risk(ether("1"), 1n)).to.be.lte(ONE);
    });
  });

  describe("normalizedRisk", function () {
    it("is 1e9 at the cap", async function () {
      const math = await deployHarness();
      const maxRisk = 6n * 10n ** 8n; // 60%
      expect(await math.normalizedRisk(maxRisk, maxRisk)).to.equal(ONE);
    });

    it("caps above maxRisk", async function () {
      const math = await deployHarness();
      const maxRisk = 6n * 10n ** 8n;
      expect(await math.normalizedRisk(ONE, maxRisk)).to.equal(ONE);
    });

    it("reverts when maxRisk is 0", async function () {
      const math = await deployHarness();
      await expect(math.normalizedRisk(0, 0)).to.be.revertedWithCustomError(math, "ZeroMaxRisk");
    });
  });

  describe("pressure", function () {
    it("is +1 when tokenIn is overweight", async function () {
      const math = await deployHarness();
      expect(await math.pressure(ether("70"), ether("30"))).to.equal(1n);
    });

    it("is -1 when tokenIn is underweight", async function () {
      const math = await deployHarness();
      expect(await math.pressure(ether("30"), ether("70"))).to.equal(-1n);
    });

    it("is 0 when balanced", async function () {
      const math = await deployHarness();
      expect(await math.pressure(ether("50"), ether("50"))).to.equal(0n);
    });
  });

  describe("finalFee", function () {
    const base = 30n * 10n ** 5n; // 30 bps in 1e9 (0.30%)
    const max = 100n * 10n ** 5n; // 100 bps
    const strength = ONE; // S = 1.0

    it("equals baseFee at r = 0", async function () {
      const math = await deployHarness();
      expect(await math.finalFee(base, max, strength, 0, 1n)).to.equal(base);
      expect(await math.finalFee(base, max, strength, 0, -1n)).to.equal(base);
    });

    it("rises toward maxFee when worsening", async function () {
      const math = await deployHarness();
      const fee = await math.finalFee(base, max, strength, ONE / 2n, 1n);
      expect(fee).to.be.gt(base);
      expect(fee).to.be.lte(max);
    });

    it("falls toward 0 when improving, never negative", async function () {
      const math = await deployHarness();
      const fee = await math.finalFee(base, max, strength, ONE / 2n, -1n);
      expect(fee).to.be.lt(base);
      expect(fee).to.be.gte(0n);
    });

    it("clamps to maxFee", async function () {
      const math = await deployHarness();
      const fee = await math.finalFee(base, max, 10n * ONE, ONE, 1n);
      expect(fee).to.equal(max);
    });

    it("clamps to 0 when the improving multiplier would go negative", async function () {
      const math = await deployHarness();
      const fee = await math.finalFee(base, max, 10n * ONE, ONE, -1n);
      expect(fee).to.equal(0n);
    });
  });

  describe("postTradeRisk and limit", function () {
    it("allows RiskPost == maxRisk", async function () {
      const math = await deployHarness();
      const maxRisk = 4n * 10n ** 8n; // 40%
      const post = await math.postTradeRisk(ether("70"), ether("30"), 0, 0);
      expect(post).to.equal(maxRisk);
      expect(await math.exceedsMaxRisk(post, maxRisk)).to.equal(false);
    });

    it("rejects RiskPost > maxRisk", async function () {
      const math = await deployHarness();
      const maxRisk = 6n * 10n ** 8n;
      const post = await math.postTradeRisk(ether("90"), ether("10"), ether("5"), ether("5"));
      expect(await math.exceedsMaxRisk(post, maxRisk)).to.equal(true);
    });

    it("treats draining the out-side as max risk", async function () {
      const math = await deployHarness();
      expect(await math.postTradeRisk(ether("50"), ether("50"), ether("10"), ether("60"))).to.equal(ONE);
    });

    it("a repairing trade reduces risk", async function () {
      const math = await deployHarness();
      const before = await math.risk(ether("70"), ether("30"));
      const after = await math.postTradeRisk(ether("30"), ether("70"), ether("10"), ether("10"));
      expect(after).to.be.lt(before);
    });
  });
});
