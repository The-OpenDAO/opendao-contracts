/* eslint-disable no-process-exit */
/* eslint-disable prettier/prettier */
import { ethers } from "hardhat";

const utils = ethers.utils;

/*
DAY=1 npx hardhat --network mainnet run scripts/getBalance.ts
*/
async function main() {
    const OpenDAOCombinedFactory = await ethers.getContractFactory("OpenDAOCombined");
    const cSOS = OpenDAOCombinedFactory.attach("0x41cbac56ea5ec878135082f0f8d9a232a854447e");
    const currentBn = await ethers.provider.getBlockNumber();
    const delta: number = Number(process.env.DAY) * 24 * 60 * 60 / 13;
    const b = await cSOS.balanceOf(process.env.DEMO_ADDR || "", {blockTag: Math.floor(currentBn - delta)});
    console.log("%s", utils.formatEther(b));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
