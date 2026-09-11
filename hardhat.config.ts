import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import 'hardhat-deploy';
import 'hardhat-tracer';
import "@typechain/hardhat";
import 'hardhat-dependency-compiler';
import { HardhatUserConfig } from 'hardhat/config';

dotenv.config();

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? ["0x" + process.env.PRIVATE_KEY] : [],
    },
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
      "@1inch/swap-vm/test/utils/ProgramBuilder.sol",
      "@1inch/solidity-utils/contracts/mocks/TokenMock.sol"
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
