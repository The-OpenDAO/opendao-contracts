/* eslint-disable node/no-missing-import */
import * as dotenv from "dotenv";
import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import { readFileSync } from "fs";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    const balance = await account.getBalance();
    console.log(
      "%s %s ether",
      account.address,
      hre.ethers.utils.formatEther(balance)
    );
  }
});

function getKeys(path: string): string[] {
  const CFG = JSON.parse(readFileSync(path, "utf-8"));
  return CFG.accounts.map((i: any) => i.sk);
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0, // workaround from https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136 . Remove when that issue is closed.
    },
    rinkeby: {
      url: process.env.RINKEBY_URL || "",
      accounts:
        process.env.RINKEBY_PRIVATE !== undefined
          ? process.env.RINKEBY_PRIVATE.split(",")
          : [],
    },
    goerli: {
      url: process.env.GOERLI_URL || "",
      accounts:
        process.env.GOERLI_PRIVATE !== undefined
          ? process.env.GOERLI_PRIVATE.split(",")
          : [],
    },
    mainnet: {
      url: process.env.MAINNET_URL || "",
      accounts: [],
    },
    mumbai: {
      url: process.env.MUMBAI_URL || "",
      accounts:
        process.env.MUMBAI_PRIVATE !== undefined
          ? process.env.MUMBAI_PRIVATE.split(",")
          : [],
    },
    polygon: {
      url: process.env.POLYGON_URL || "",
      accounts: [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 20000,
  },
};

export default config;
