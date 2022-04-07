import hre from "hardhat";
import { getENV, getNonce } from "../utils/network";

async function main() {
  const ethers = hre.ethers;
  const [owner] = await ethers.getSigners();
  const distributeFactory = await ethers.getContractFactory("OpenDAOWLDistribute");
  const distribute = await distributeFactory.attach(getENV(hre, "distribute"));
  
  const ProjectID = 1;

  const tx = await distribute.connect(owner).requestWL(ProjectID);
  console.log("Waiting requestWL transaction finish:" + tx.hash);
  const receipt = await tx.wait();
  console.log(receipt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});