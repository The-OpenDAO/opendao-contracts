/* eslint-disable prefer-const */
/* eslint-disable node/no-missing-import */
/* eslint-disable prettier/prettier */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { MyERC20, OpenDAOLock } from "../typechain";
import { sleep } from "../utils/timestamp";
// 0.000000001 Ether = 1Gwei
const provider = ethers.provider;

// eslint-disable-next-line no-unused-vars
const utils = ethers.utils;

let owner: SignerWithAddress;
// eslint-disable-next-line no-unused-vars
let alice: SignerWithAddress;
// eslint-disable-next-line no-unused-vars
let bob: SignerWithAddress;
// eslint-disable-next-line no-unused-vars
let charlie: SignerWithAddress;
// eslint-disable-next-line no-unused-vars
let david: SignerWithAddress;

let sos: MyERC20;
let lock: OpenDAOLock;
const lockDuration = 2;

async function init() {
    expect(31337).eq((await provider.getNetwork()).chainId);
    [owner, alice, bob, charlie, david] = await ethers.getSigners();
    sos = await (await ethers.getContractFactory("MyERC20")).connect(owner).deploy("SOS");
    lock = await (await ethers.getContractFactory("OpenDAOLock")).connect(owner).deploy(sos.address, lockDuration);
}

function b(amount: bigint): BigNumber { return utils.parseEther(amount.toString()) }

async function deposit(account: SignerWithAddress, amount: BigNumber) {
    await sos.connect(account).approve(lock.address, amount);
    await sos.connect(account).mint(amount);
}

async function mineBlock(n: number) {
    const jobs = [];
    for (let index = 0; index < n; index++) jobs.push(ethers.provider.send("evm_mine", []));
    await Promise.all(jobs);
}

/*
npx hardhat test test/test-lock.ts
*/
describe("test-lock.ts", function () {
    it("lock should fail", async () => {
        await init();
        await expect(lock.connect(alice).lock(0)).revertedWith("OpenDAOLock: Invalid amount");
    });

    it("lock should work", async () => {
        await init();
        await deposit(alice, b(100n));
        expect(await lock.locked(alice.address)).eq(0);
        expect(await sos.balanceOf(lock.address)).eq(0);
        expect(await sos.balanceOf(alice.address)).eq(b(100n));
        await lock.connect(alice).lock(b(50n));
        expect(await sos.balanceOf(lock.address)).eq(b(50n));
        expect(await lock.locked(alice.address)).eq(b(50n));
        expect(await sos.balanceOf(alice.address)).eq(b(50n));
        await lock.connect(alice).lock(b(50n));
        expect(await sos.balanceOf(lock.address)).eq(b(100n));
        expect(await lock.locked(alice.address)).eq(b(100n));
        expect(await sos.balanceOf(alice.address)).eq(0);
    });

    it("unlock should fail", async () => {
        await init();
        await deposit(alice, b(100n));
        await lock.connect(alice).lock(b(100n));
        await expect(lock.connect(alice).unlock(b(100n))).to.revertedWith("OpenDAOLock: Assets locked");
        await expect(lock.connect(alice).unlock(0)).revertedWith("OpenDAOLock: Invalid amount");
    });

    it("unlock should work", async () => {
        await init();
        await deposit(alice, b(100n));
        await lock.connect(alice).lock(b(50n));
        await lock.connect(alice).lock(b(50n));
        {
            const { _lockTime, _now } = await lock.lockTime(alice.address);
            const { _unlockTime } = await lock.unlockTime(alice.address);
            expect(_lockTime.toNumber()).eq(_now.toNumber());
            expect(_unlockTime.toNumber()).eq(_lockTime.toNumber() + lockDuration);
        }
        await sleep((lockDuration + 1) * 1000);
        await mineBlock(1);
        {
            const { _unlockTime, _now } = await lock.unlockTime(alice.address);
            expect(_unlockTime.toNumber()).lessThan(_now.toNumber());
        }

        expect(await sos.balanceOf(lock.address)).eq(b(100n));
        expect(await lock.locked(alice.address)).eq(b(100n));

        await lock.connect(alice).unlock(b(50n));
        expect(await lock.locked(alice.address)).eq(b(50n));
        expect(await sos.balanceOf(lock.address)).eq(b(50n));
        expect(await sos.balanceOf(alice.address)).eq(b(50n));

        await lock.connect(alice).unlock(b(50n));
        expect(await lock.locked(alice.address)).eq(0);
        expect(await sos.balanceOf(lock.address)).eq(0);
        expect(await sos.balanceOf(alice.address)).eq(b(100n));

        await expect(lock.connect(alice).unlock(b(100n))).revertedWith("OpenDAOLock: Insufficient amount to withdraw");
    });
});
