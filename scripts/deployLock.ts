/* eslint-disable node/no-missing-import */
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import hre from "hardhat";
import { getENV, getNonce } from "../utils/network";

/*
npx hardhat --network rinkeby run scripts/deployLock.ts

npx hardhat --network mainnet run scripts/deployLock.ts
*/
async function main(): Promise<void> {
  const ethers = hre.ethers;
  const utils = ethers.utils;
  const [owner] = await ethers.getSigners();

  const sosAddress = getENV(hre, "sos");
  const duration = Number(getENV(hre, "Duration"));

  const lock = await (await ethers.getContractFactory("OpenDAOLock"))
    .connect(owner)
    .deploy(sosAddress, duration, {
      maxFeePerGas: utils.parseUnits("200", "gwei"),
      maxPriorityFeePerGas: utils.parseUnits("1.01", "gwei"),
      nonce: await getNonce(owner),
    });
  console.log("deploying to:", lock.address);
  console.log(
    "npx hardhat --network %s verify --contract contracts/OpenDAOLock.sol:OpenDAOLock %s %s %s",
    hre.network.name,
    lock.address,
    sosAddress,
    duration
  );
  await lock.deployed();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
