import hre from "hardhat";
import { getENV, getNonce } from "../utils/network";

async function main() {
  const ethers = hre.ethers;
  const [owner] = await ethers.getSigners();
  const distributeFactory = await ethers.getContractFactory("OpenDAOWLDistribute");
  const distribute = await distributeFactory.attach(getENV(hre, "distribute"));
  //await distribute.addProject("TestXYZ", {totalSupply: 1000, price: 5000, totalBought: 0, startTime: 1649227867, endTime: 2649227867, isEnabled: true});
  //await distribute.connect(owner).requestWL(1);

  let filter = distribute.filters.RequestWL(null, null, null, null);
  console.log(filter);

  let eventsWith = await distribute.queryFilter(filter, -10000, "latest");
  console.log(eventsWith);
  //console.log(eventsWith[0].args.requester);
  //console.log(eventsWith[0].args.projectID);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});