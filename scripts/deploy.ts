/* eslint-disable prettier/prettier */
/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { timestampInSecond } from "../utils/timestamp";
import { OpenDAOStaking } from "../typechain";
import { YEAR, HOUR } from "../utils/constants";

const utils = ethers.utils;

/**
npx hardhat --network rinkeby run scripts/deploy.ts
npx hardhat --network rinkeby verify --contract contracts/MyERC20.sol:MyERC20 0x00 TSOS
npx hardhat --network rinkeby verify --contract contracts/OpenDAOStaking.sol:OpenDAOStaking 0x00 0x00 1640879570 31536000
 */
async function main() {
  const [owner] = await ethers.getSigners();

  // const MyERC20Factory = await ethers.getContractFactory("MyERC20");
  // const SOS: MyERC20 = await MyERC20Factory.connect(owner).deploy("TSOS", {
  //   maxFeePerGas: utils.parseUnits("85", "gwei"),
  //   maxPriorityFeePerGas: utils.parseUnits("2", "gwei"),
  //   gasLimit: 3519404,
  // });
  // console.log("TSOS deployed to:", SOS.address);

  // (+new Date("2022-01-01T00:00:00Z")) / 1000
  // 1640995200
  const now = timestampInSecond();
  const OpenDAOStakingFactory = await ethers.getContractFactory("OpenDAOStaking");
  const veSOS: OpenDAOStaking = await OpenDAOStakingFactory.connect(owner).deploy(
    "0x00", now + 2 * HOUR, YEAR, {
      maxFeePerGas: utils.parseUnits("85", "gwei"),
      maxPriorityFeePerGas: utils.parseUnits("2", "gwei"),
      gasLimit: 3519404,
    });
  console.log("now + 2 * HOUR = %s", now + 2 * HOUR);
  console.log("YEAR = %s", YEAR);
  console.log("veSOS deployed to:", veSOS.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
