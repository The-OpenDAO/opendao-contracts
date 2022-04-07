import hre from "hardhat";
import { getENV, getNonce } from "../utils/network";

async function main() {
  const ethers = hre.ethers;
  const [owner] = await ethers.getSigners();
  const distributeFactory = await ethers.getContractFactory("OpenDAOWLDistribute");
  const distribute = await distributeFactory.attach(getENV(hre, "distribute"));
  
  //Read global variables
  const pjs = await distribute.projects(3);
  console.log("logging project #3 metadata:");
  console.log(pjs);
  console.log("totalOwned=" + pjs.totalOwned);
  console.log("totalSupply=" + pjs.totalSupply);
  console.log("startTime=" + pjs.startTime);
  console.log("logging project #3 done");
  console.log("==============================");

  //Wait for the function executaed
  let ppid = 0;
  console.log("Adding new project:");
  const tx = await distribute.addProject("TestXYZ", {totalSupply: 1000, price: 5000, totalOwned: 0, startTime: 1649227867, endTime: 2649227867, isEnabled: true});
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

  //Apply a whitelist for the project #3
  //await distribute.connect(owner).requestWL(3);

  //Scan all the old event emitted from the contract, filter inside the loop
  let filter = distribute.filters.RequestWL(null, null, null, null);
  const ProjectID = 3;
  let eventsWith = await distribute.queryFilter(filter, -10000, "latest");
  console.log("Project #" + ProjectID + " whitelist addresses: (total " + pjs.totalOwned + ")");
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