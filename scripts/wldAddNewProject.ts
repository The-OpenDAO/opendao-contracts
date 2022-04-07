import hre from "hardhat";
import { getENV, getNonce } from "../utils/network";

async function main() {
  const ethers = hre.ethers;
  const utils = ethers.utils;
  const [owner] = await ethers.getSigners();
  const distributeFactory = await ethers.getContractFactory("OpenDAOWLDistribute");
  console.log(getENV(hre, "distribute"));
  const distribute = await distributeFactory.attach(getENV(hre, "distribute"));

  let ppid = 0;
  const prjdata = {
    totalSupply: 1000, 
    price: 5000, 
    totalBought: 0, 
    startBlock: 0, 
    startTime: 1649227867, 
    endTime: 2649227867, 
    isEnabled: true
  };
  console.log("Adding new project:");
  const tx = await distribute.addProject("TestXYZ", prjdata);
  console.log("Waiting new project transaction:" + tx.hash);
  const receipt = await tx.wait();
  if(receipt && receipt.events && receipt.events.length > 0) {
    const data = receipt.events[0];
    if(data && data.args) {
      ppid = data.args.projectID;
    }
  }
  if (ppid > 0) {
    console.log("New project ID:" + ppid);
  } else {
    console.log("Adding new project failed");
  }
  console.log("==============================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});