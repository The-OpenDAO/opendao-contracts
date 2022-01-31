/* eslint-disable no-process-exit */
/* eslint-disable prettier/prettier */
import { ethers } from "ethers";
import * as dotevn from "dotenv";

dotevn.config();
const utils = ethers.utils;
const URL = process.env.MAINNET_URL || "";

/*
ts-node scripts/getBalance.ts
*/
async function main() {
    const addr = "0x41cbac56ea5ec878135082f0f8d9a232a854447e";
    const provider = new ethers.providers.JsonRpcProvider(URL);
    const cSOS = new ethers.Contract(addr, [
        "function balanceOf(address account) external view returns (uint256)"
    ], provider);

    const currentBn = await provider.getBlockNumber();

    for (let i = 0; i < 10; ++i) {
        const delta: number = i * 24 * 60 * 60 / 14;
        const blockTag = Math.floor(currentBn - delta);
        const balance = await cSOS.balanceOf(process.env.DEMO_ADDR || "", { blockTag });
        console.log("%s %s %s", i, blockTag, utils.formatEther(balance));
    }

}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
