/* eslint-disable no-process-exit */
/* eslint-disable prettier/prettier */
import { ethers } from "hardhat";

const utils = ethers.utils;

/**
npx hardhat --network rinkeby run scripts/deployCombinedSOS.ts
npx hardhat --network rinkeby verify --contract contracts/OpenDAOCombined.sol:OpenDAOCombined 0x00
 */
async function main() {
    const [owner] = await ethers.getSigners();

    const OpenDAOCombinedFactory = await ethers.getContractFactory("OpenDAOCombined");
    const openDAOCombined = await OpenDAOCombinedFactory.connect(owner).deploy({
        maxFeePerGas: utils.parseUnits("120", "gwei"),
        maxPriorityFeePerGas: utils.parseUnits("1.18", "gwei"),
        gasLimit: 3519404,
    });

    console.log("Combined SOS contract address:", openDAOCombined.address);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
