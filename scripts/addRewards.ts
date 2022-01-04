/* eslint-disable camelcase */
/* eslint-disable prettier/prettier */
/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { timestampInSecond } from "../utils/timestamp";
import { OpenDAOStaking } from "../typechain";
import { YEAR, HOUR } from "../utils/constants";

const utils = ethers.utils;

/**
npx hardhat --network rinkeby run scripts/addRewards.ts
 */
async function main() {
  const [owner] = await ethers.getSigners();

  const sos_address = process.env.sos_address as string;
  const veSOS_address = process.env.veSOS_address as string;
  const SOS = (await ethers.getContractFactory("MyERC20")).attach(sos_address);
  const veSOS = (await ethers.getContractFactory("OpenDAOStaking")).attach(veSOS_address);

  let nonce = await owner.getTransactionCount();
  console.log("%s nonce %s", owner.address, nonce);

  await SOS.connect(owner).mint(BigInt(1e32), {
    maxFeePerGas: utils.parseUnits("85", "gwei"),
    maxPriorityFeePerGas: utils.parseUnits("1.1", "gwei"),
    gasLimit: 3519404,
    nonce: nonce++,
  });
  await SOS.connect(owner).approve(veSOS.address, BigInt(1e32), {
    maxFeePerGas: utils.parseUnits("85", "gwei"),
    maxPriorityFeePerGas: utils.parseUnits("1.1", "gwei"),
    gasLimit: 3519404,
    nonce: nonce++,
  });
  await veSOS.connect(owner).addRewardSOS(BigInt(2e+31), {
    maxFeePerGas: utils.parseUnits("85", "gwei"),
    maxPriorityFeePerGas: utils.parseUnits("1.1", "gwei"),
    gasLimit: 3519404,
    nonce: nonce++,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
