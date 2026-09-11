import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Trader verification: safe swap settles, unsafe reverts with no settlement.
async function main() {
  const signers = await ethers.getSigners();
  const trader = signers[2] ?? signers[0];
  const traderAddr = await trader.getAddress();
  const d = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../web/lib/deployment.json"),
      "utf8",
    ),
  );
  const swapVM = await ethers.getContractAt("SisuSwapVMRouter", d.swapVM);
  const eth = await ethers.getContractAt(
    "@1inch/solidity-utils/contracts/mocks/TokenMock.sol:TokenMock",
    d.eth,
  );
  const order = { maker: d.order.maker, traits: d.order.traits, data: d.order.data };

  // Taker traits: exactIn + transferFrom/push + A->B (ethIsA true, ETH in).
  const pack = (isAToB: boolean) => {
    const flags = 0x0001 | 0x0040 | (isAToB ? 0x0080 : 0);
    const slices = "0x" + "00".repeat(20);
    const flagHex = flags.toString(16).padStart(4, "0");
    return slices + flagHex.slice(0, 0) + "0x".slice(2) + "" + flagHex;
  };
  const traits = ("0x" + "00".repeat(20) + (0x00c1).toString(16).padStart(4, "0")) as string;

  const balBefore = await eth.balanceOf(traderAddr);
  const [qIn, qOut] = await swapVM.quote.staticCall(
    order,
    ethers.parseEther("0.05"),
    traits,
  );
  console.log(`safe quote: in=${ethers.formatEther(qIn)} out=${ethers.formatEther(qOut)}`);
  await (await swapVM.connect(trader).swap(order, ethers.parseEther("0.05"), traits)).wait();
  const balAfter = await eth.balanceOf(traderAddr);
  console.log(`safe swap settled, trader ETH delta=${ethers.formatEther(balAfter - balBefore)}`);

  const makerBalBefore = await eth.balanceOf(d.maker);
  try {
    await swapVM.connect(trader).swap.staticCall(
      order,
      ethers.parseEther("5"),
      traits,
    );
    console.log("UNEXPECTED: unsafe quote did not revert");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 120) : String(e);
    console.log(`unsafe reverts as required: ${msg}`);
  }
  try {
    await swapVM.connect(trader).swap(order, ethers.parseEther("5"), traits);
    console.log("UNEXPECTED: unsafe swap did not revert");
  } catch {
    console.log("unsafe swap reverted on send (no settlement)");
  }
  const makerBalAfter = await eth.balanceOf(d.maker);
  console.log(`maker balance unchanged: ${makerBalBefore === makerBalAfter}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
