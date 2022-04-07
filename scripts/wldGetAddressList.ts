import hre from "hardhat";
import { getENV, getNonce } from "../utils/network";

async function main() {
  const ethers = hre.ethers;
  const [owner] = await ethers.getSigners();
  const distributeFactory = await ethers.getContractFactory("OpenDAOWLDistribute");
  const distribute = await distributeFactory.attach(getENV(hre, "distribute"));
  
  const ProjectID = 1;

  console.log("logging project #" + ProjectID + " global variales:");
  const pjs = await distribute.projects(ProjectID);
  console.log(pjs);

  console.log("Project #" + ProjectID + " whitelist addresses: (total " + pjs.totalBought + ")");
  let filter = distribute.filters.RequestWL(null, null, null, null);
  let eventsWith = await distribute.queryFilter(filter, pjs.startBlock, "latest");
  for (let i=0; i<eventsWith.length; i++) {
    let pid = eventsWith[i].args.projectID.toNumber();
    if(pid == ProjectID) {
      console.log(eventsWith[0].args.requester);
    }
  }
  console.log("==============================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});