import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Verifies the Sepolia Sisu stack on Etherscan V2 with standard-json input
// (preserves viaIR settings + metadata). Needs ETHERSCAN_API_KEY in .env.
const CHAIN_ID = 11155111;
const API = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}`;

async function submit(
  apiKey: string,
  address: string,
  contractName: string,
  standardJson: string,
): Promise<string> {
  const params = new URLSearchParams({
    module: "contract",
    action: "verifysourcecode",
    apikey: apiKey,
    contractaddress: address,
    sourceCode: standardJson,
    codeformat: "solidity-standard-json-input",
    contractname: contractName,
    compilerversion: "v0.8.30+commit.73712a01",
    optimizationUsed: "1",
    runs: "1",
    evmversion: "cancun",
    licenseType: "1",
  });
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = (await res.json()) as { status: string; message: string; result: string };
  if (json.status !== "1") throw new Error(`submit: ${json.message}: ${json.result}`);
  return json.result;
}

async function poll(apiKey: string, guid: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 15000));
    const url =
      `${API}&module=contract&action=checkverifystatus` +
      `&guid=${guid}&apikey=${apiKey}`;
    const res = await fetch(url);
    const json = (await res.json()) as { status: string; result: string };
    if (/pass|success|already verified/i.test(json.result)) return json.result;
    if (/fail|error|unable|invalid/i.test(json.result)) return json.result;
    console.log(`  pending: ${json.result}`);
  }
  return "timeout";
}

async function main() {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY missing");
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../web/lib/deployment.json"), "utf8"),
  ) as Record<string, string>;

  const buildInfos = fs
    .readdirSync(path.join(__dirname, "../artifacts/build-info"))
    .filter((f) => f.endsWith(".json"));
  const targets: { label: string; address: string; file: string; name: string }[] = [
    { label: "Aqua", address: deployment.aqua, file: "@1inch/aqua/src/Aqua.sol", name: "Aqua" },
    { label: "SisuStrategy", address: deployment.sisuStrategy, file: "contracts/strategy/SisuStrategy.sol", name: "SisuStrategy" },
    { label: "SisuSwapVMRouter", address: deployment.swapVM, file: "contracts/routers/SisuSwapVMRouter.sol", name: "SisuSwapVMRouter" },
  ];
  for (const t of targets) {
    const info = buildInfos
      .map((f) => ({
        f,
        json: JSON.parse(
          fs.readFileSync(path.join(__dirname, "../artifacts/build-info", f), "utf8"),
        ) as { input: unknown; output: { contracts: Record<string, Record<string, unknown>> } },
      }))
      .find(({ json }) => json.output.contracts?.[t.file]?.[t.name]);
    if (!info) {
      console.log(`${t.label}: no build-info found, skipping`);
      continue;
    }
    let guid: string;
    try {
      guid = await submit(apiKey, t.address, `${t.file}:${t.name}`, JSON.stringify((info.json as { input: unknown }).input));
    } catch (err) {
      if (err instanceof Error && /already verified/i.test(err.message)) {
        console.log(`${t.label} ${t.address}: already verified`);
        continue;
      }
      throw err;
    }
    console.log(`${t.label} ${t.address}: guid=${guid}`);
    const status = await poll(apiKey, guid);
    console.log(`${t.label}: ${status}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
