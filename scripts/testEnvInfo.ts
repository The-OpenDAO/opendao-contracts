/* eslint-disable prettier/prettier */
/* eslint-disable node/no-missing-import */
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import hre from "hardhat";
import { getENV } from "../utils/network";

/*
npx hardhat --network rinkeby run --no-compile scripts/testEnvInfo.ts
*/
async function main(): Promise<void> {
  const ethers = hre.ethers;
  const utils = ethers.utils;
  const [owner] = await ethers.getSigners();

  const lockAddress = getENV(hre, "lock");
  const sosAddress = getENV(hre, "sos");

  const lock = (await ethers.getContractFactory("OpenDAOLock")).attach(lockAddress);
  const sos = (await ethers.getContractFactory("MyERC20")).attach(sosAddress);

  const [
    locked,
    ownerSOS,
    lockSOS,
    allowance,
  ] = await Promise.all([
    lock.locked(owner.address),
    sos.balanceOf(owner.address),
    sos.balanceOf(lock.address),
    sos.allowance(owner.address, lock.address),
  ]);

  console.log("owner locked %s", utils.formatEther(locked));
  console.log("owner SOS %s", utils.formatEther(ownerSOS));
  console.log("lock contract SOS %s", utils.formatEther(lockSOS));
  console.log("allowance %s", utils.formatEther(allowance));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
