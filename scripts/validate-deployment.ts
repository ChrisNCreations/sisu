import hre from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

import { MANIFEST_VERSION, validateManifest, type DeploymentManifest } from '../deploy/manifest';
import { validateDeployment } from '../deploy/validate';

// Post-deployment validation. Reads a versioned manifest and fails closed when the
// on-chain stack disagrees with it. Read-only: never sends a transaction.
//
//   npx hardhat run scripts/validate-deployment.ts --network localhost
//   npx hardhat run scripts/validate-deployment.ts --network sepolia -- deployments/sisu-sepolia.json
function resolveManifestPath(): string {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const explicit = args.length > 0 ? args[args.length - 1] : undefined;
  if (explicit && /\.json$/i.test(explicit)) return path.resolve(explicit);
  return path.join(__dirname, '..', 'deployments', `sisu-${hre.network.name}.json`);
}

async function main() {
  const manifestPath = resolveManifestPath();
  if (!fs.existsSync(manifestPath)) {
    console.error(`No manifest at ${manifestPath}.`);
    console.error('Run the Sisu deploy first, or pass a manifest path as an argument.');
    process.exit(1);
  }

  let manifest: DeploymentManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as DeploymentManifest;
  } catch (err) {
    console.error(`Could not parse ${manifestPath}:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(`[sisu] validating ${manifestPath} (manifestVersion ${manifest.manifestVersion ?? 'missing'})`);

  const schemaProblems = validateManifest(manifest);
  if (schemaProblems.length > 0) {
    console.error(`Manifest schema is invalid (expected manifestVersion ${MANIFEST_VERSION}):`);
    for (const problem of schemaProblems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const { errors, warnings } = await validateDeployment({
    provider: hre.ethers.provider,
    manifest,
    expectedChainId: manifest.chainId,
  });

  for (const warning of warnings) console.warn(`  warning: ${warning}`);

  if (errors.length > 0) {
    console.error(`\nDeployment validation FAILED with ${errors.length} problem(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log('\nDeployment validation passed.');
  console.log(`  chain:    ${manifest.chainId} (${manifest.network})`);
  console.log(`  aqua:     ${manifest.aqua}`);
  console.log(`  strategy: ${manifest.sisuStrategy}`);
  console.log(`  router:   ${manifest.swapVM}`);
  console.log(`  weth:     ${manifest.weth}`);
  console.log(`  usdc:     ${manifest.usdc}`);
  console.log(`  oracle:   ${manifest.aggregator} (${manifest.oracle.decimals}d)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
