require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY        = process.env.PRIVATE_KEY        || "0x0000000000000000000000000000000000000000000000000000000000000001";
const SEPOLIA_RPC_URL    = process.env.SEPOLIA_RPC_URL    || "";
const POLYGON_RPC_URL    = process.env.POLYGON_RPC_URL    || "https://polygon-rpc.com";
const BASE_RPC_URL       = process.env.BASE_RPC_URL       || "https://mainnet.base.org";
const ARBITRUM_RPC_URL   = process.env.ARBITRUM_RPC_URL   || "https://arb1.arbitrum.io/rpc";
const ETHERSCAN_API_KEY  = process.env.ETHERSCAN_API_KEY  || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const BASESCAN_API_KEY   = process.env.BASESCAN_API_KEY   || "";
const ARBISCAN_API_KEY   = process.env.ARBISCAN_API_KEY   || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },
    polygon: {
      url: POLYGON_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 137,
    },
    base: {
      url: BASE_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 8453,
    },
    arbitrum: {
      url: ARBITRUM_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 42161,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};
