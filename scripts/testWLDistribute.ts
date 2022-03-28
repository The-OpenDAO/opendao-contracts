import hre from "hardhat";
import { getENV, getNonce } from "../utils/network";

async function main() {
  const ethers = hre.ethers;
  const distributeFactory = await ethers.getContractFactory("OpenDAOWLDistribute");
  const distribute = await distributeFactory.attach(getENV(hre, "distribute"));
  await distribute.toggleEnable(1);
  //transfer some SOS to the account
  //request WL
  //get the start block
  //get all the events from start to latest
  //parse and list all the accounts that request the WL
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});