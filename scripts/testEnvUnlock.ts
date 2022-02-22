/* eslint-disable prettier/prettier */
/* eslint-disable node/no-missing-import */
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import hre from "hardhat";
import { getENV, getNonce } from "../utils/network";

/*
npx hardhat --network rinkeby run --no-compile scripts/testEnvUnlock.ts
*/
async function main(): Promise<void> {
  const ethers = hre.ethers;
  const utils = ethers.utils;
  const [owner] = await ethers.getSigners();
  const lockAddress = getENV(hre, "lock");
  const lock = (await ethers.getContractFactory("OpenDAOLock")).attach(lockAddress);
  const nonce = await getNonce(owner);
  await lock.connect(owner).unlock(utils.parseEther("100"), {
    nonce,
    maxPriorityFeePerGas: utils.parseUnits("1", "gwei"),
    maxFeePerGas: utils.parseUnits("200", "gwei"),
    gasLimit: 1000000,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
