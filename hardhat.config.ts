import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import 'hardhat-deploy';
import 'hardhat-tracer';
import "@typechain/hardhat";
import 'hardhat-dependency-compiler';
import { HardhatUserConfig } from 'hardhat/config';

import { SEPOLIA_CHAIN_ID, requireEnv } from './deploy/env';

dotenv.config();

/** The network selected on the command line (`--network foo` or `--network=foo`). */
function selectedNetwork(): string | undefined {
  const args = process.argv.slice(2);
  const flag = args.indexOf('--network');
  if (flag !== -1 && args[flag + 1]) return args[flag + 1];
  const inline = args.find((arg) => arg.startsWith('--network='));
  return inline ? inline.slice('--network='.length) : undefined;
}

/**
 * Hardhat evaluates this config for every task, so required Sepolia variables are
 * enforced only when Sepolia is the selected network. All other commands stay usable
 * without secrets, while a Sepolia run fails clearly instead of silently connecting
 * with an empty RPC URL or no signer.
 */
function sepoliaNetwork(): { url: string; accounts: string[]; chainId: number } {
  const accounts = process.env.PRIVATE_KEY
    ? ['0x' + process.env.PRIVATE_KEY.replace(/^0x/, '')]
    : [];
  if (selectedNetwork() !== 'sepolia') {
    return { url: process.env.SEPOLIA_RPC_URL || '', accounts, chainId: SEPOLIA_CHAIN_ID };
  }
  return {
    url: requireEnv('SEPOLIA_RPC_URL'),
    accounts: ['0x' + requireEnv('PRIVATE_KEY').replace(/^0x/, '')],
    chainId: SEPOLIA_CHAIN_ID,
  };
}

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: sepoliaNetwork(),
    buildbear: {
      url: process.env.BUILDBEAR_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? ["0x" + process.env.PRIVATE_KEY] : [],
    },
    // Add your deployment network here and the corresponding URL in the .env file
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
            details: {
              yul: true,
            }
          },
          evmVersion: "cancun",
          viaIR: true
        }
      }
    ],
  },
  dependencyCompiler: {
    paths: [
      "@1inch/aqua/src/Aqua.sol",
      "@1inch/swap-vm/src/routers/AquaSwapVMRouter.sol",
      "@1inch/swap-vm/src/routers/SwapVMRouter.sol",
      "@1inch/swap-vm/test/mocks/WETHMock.sol",
      "@1inch/solidity-utils/contracts/mocks/TokenMock.sol",
      "@1inch/solidity-utils/contracts/mocks/TokenCustomDecimalsMock.sol"
    ]
  },
  typechain: {
    outDir: "typechain-types",
  },
  etherscan: {
    apiKey: {
      // Etherscan API V2 uses one key for all chains.
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      mainnet: process.env.ETHERSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=11155111",
          browserURL: "https://sepolia.etherscan.io",
        },
      },
    ],
  }
};

export default config;
