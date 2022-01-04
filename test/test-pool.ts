/* eslint-disable prefer-const */
/* eslint-disable node/no-missing-import */
/* eslint-disable prettier/prettier */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { OpenDAOStaking, MyERC20 } from "../typechain";
import { timestampInSecond } from "../utils/timestamp";
import { MONTH, MINUTE, DAY, YEAR, HOUR } from "../utils/constants";
// 0.000000001 Ether = 1Gwei
const provider = ethers.provider;
let now = timestampInSecond();

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

let SOS: MyERC20;
let veSOS: OpenDAOStaking;

async function init(start: number, duration: number) {
  expect(31337).eq((await provider.getNetwork()).chainId);
  [owner, alice, bob, charlie, david] = await ethers.getSigners();

  const MyERC20Factory = await ethers.getContractFactory("MyERC20");
  SOS = await MyERC20Factory.connect(owner).deploy("SOS");

  const OpenDAOPoolFactory = await ethers.getContractFactory("OpenDAOStaking");
  veSOS = await OpenDAOPoolFactory.connect(owner).deploy(SOS.address, start, duration);

  await veSOS.setblockTime(now);
}

async function depositSOS(signer: SignerWithAddress, amount: bigint) {
  await SOS.connect(signer).mint(e(amount));
  await SOS.connect(signer).approve(veSOS.address, e(BigInt(1e14)));
}

// eslint-disable-next-line no-unused-vars
function e2b(amount: bigint): BigNumber { return BigNumber.from(amount.toString()) }
function e(amount: bigint): bigint { return amount * BigInt(1e18) }
function b(amount: bigint): BigNumber { return utils.parseEther(amount.toString()) }
function b2e(amount: BigNumber): bigint { return BigInt(amount.toString()) }

async function advance(duration: number): Promise<number> {
  const t = (await veSOS.blockTime()).toNumber() + duration;
  now = t;
  await veSOS.connect(owner).setblockTime(t);
  return t;
}

async function predictEneter(_sosAmount: bigint): Promise<bigint> {
  const totalSOS = BigInt((await veSOS.getSOSPool()).toString());
  const totalShares = BigInt((await veSOS.totalSupply()).toString());
  if (totalShares === 0n || totalSOS === 0n) {
    return _sosAmount;
  } else {
    return _sosAmount * totalShares / totalSOS;
  }
}

async function predictLeave(_share: bigint): Promise<bigint> {
  const totalSOS = BigInt((await veSOS.getSOSPool()).toString());
  const totalShares = BigInt((await veSOS.totalSupply()).toString());
  return _share * totalSOS / totalShares;
}

async function getSOSPoolTS(): Promise<bigint> {
  const cfg = await veSOS.config();
  const duration = b2e(cfg.periodFinish) - b2e(cfg.periodStart);
  let remainingTime: bigint;
  if (now <= cfg.periodStart.toNumber()) {
    remainingTime = duration;
  } else if (now >= cfg.periodFinish.toNumber()) {
    remainingTime = 0n;
  } else {
    remainingTime = BigInt(cfg.periodFinish.toNumber() - now);
  }
  const sosPool = b2e(await SOS.balanceOf(veSOS.address));
  return sosPool - remainingTime * b2e(cfg.totalReward) / duration;
}

/*
npx hardhat test test/test-pool.ts
*/
describe("test-pool.ts", function () {
  it("limitation min", async () => {
    const totalReward = BigInt(2e13);
    await init(now + DAY, YEAR);

    await depositSOS(david, totalReward);
    await veSOS.connect(david).addRewardSOS(e(totalReward));

    await SOS.connect(alice).mint(1);
    await SOS.connect(alice).approve(veSOS.address, e(BigInt(1e14)));

    let value = await predictEneter(1n);
    await veSOS.connect(alice).enter(1);
    expect(value).eq(await veSOS.balanceOf(alice.address));
    expect(1n).eq(value);

    await advance(YEAR * 2);

    let leaveValue = await predictLeave(value);
    await veSOS.connect(alice).leave(value);
    expect(leaveValue).eq(await SOS.balanceOf(alice.address));
    expect(leaveValue).eq(20000000000000000000000000000001n);
    expect(0n).eq(await veSOS.balanceOf(alice.address));
    // expect(BigInt(2e31) + 1n).eq(leaveValue);
    expect(BigInt(2e13) * BigInt(1e18) + 1n).eq(leaveValue);
    // console.log(leaveValue)
    // console.log(BigInt(2e13) * BigInt(1e18) + 1n)
  });

  it("limitation max", async () => {
    const otherSOS = BigInt(1e14 - 2e13);
    const totalReward = BigInt(2e13);
    await init(now + DAY, YEAR);

    await depositSOS(david, totalReward);
    await veSOS.connect(david).addRewardSOS(e(totalReward));

    await depositSOS(alice, otherSOS);
    let value = await predictEneter(e(otherSOS));
    await veSOS.connect(alice).enter(b(otherSOS));
    expect(value).eq(await veSOS.balanceOf(alice.address));

    await advance(YEAR * 2);

    value = await predictLeave(value);
    await veSOS.connect(alice).leave(await veSOS.balanceOf(alice.address));
    expect(value).eq(await SOS.balanceOf(alice.address));
    expect(0n).eq(await veSOS.balanceOf(alice.address));
    expect(e(BigInt(1e14))).eq(value);
  });

  it("setPeriod should fail", async () => {
    await init(now + DAY, YEAR);

    await expect(veSOS.connect(owner).setPeriod(now, 0)).to
      .revertedWith("OpenDAOStaking: Invalid rewards duration");

    await expect(veSOS.connect(owner).setPeriod(now + MONTH, YEAR)).to
      .revertedWith("OpenDAOStaking: The last reward period should be finished before setting a new one");

    await advance(YEAR + MONTH);
    await veSOS.connect(owner).setPeriod(now, YEAR);
  });

  it("addRewardSOS should fail", async () => {
    await init(now + DAY, YEAR);

    const totalReward = BigInt(2e13);
    await depositSOS(owner, totalReward);

    await advance(YEAR + DAY);
    await expect(veSOS.connect(owner).addRewardSOS(e(totalReward)))
      .to.revertedWith("OpenDAOStaking: Adding rewards is forbidden");

    await advance(YEAR + DAY);
    await veSOS.connect(owner).setPeriod(now, YEAR);
    await veSOS.connect(owner).addRewardSOS(e(totalReward));
  });

  it("before faucet with addReward", async () => {
    const totalReward = BigInt(2e13);
    await init(now + DAY, YEAR);

    // initial user
    await depositSOS(alice, 100n);
    await depositSOS(bob, 100n);
    await depositSOS(charlie, 100n);
    await depositSOS(owner, totalReward);

    // initial pool
    await veSOS.connect(owner).addRewardSOS(e(totalReward));
    expect(0).eq(await veSOS.getSOSPool());

    // check config
    const config = await veSOS.config();
    expect(now + DAY).eq(config.periodStart.toNumber());
    expect(now + DAY + YEAR).eq(config.periodFinish.toNumber());
    expect(b(totalReward)).eq(config.totalReward);

    await veSOS.connect(alice).enter(b(100n));
    await veSOS.connect(bob).enter(b(100n));
    await veSOS.connect(charlie).enter(b(100n));

    expect(0).eq(await SOS.balanceOf(alice.address));
    expect(0).eq(await SOS.balanceOf(bob.address));
    expect(0).eq(await SOS.balanceOf(charlie.address));

    expect(b(300n)).eq(await veSOS.getSOSPool());
    expect(b(100n)).eq(await veSOS.balanceOf(alice.address));
    expect(b(100n)).eq(await veSOS.balanceOf(bob.address));
    expect(b(100n)).eq(await veSOS.balanceOf(charlie.address));

    await advance(DAY * 2);
    expect(await getSOSPoolTS()).eq(await veSOS.getSOSPool());

    let value = await predictLeave(e(100n));
    await veSOS.connect(alice).leave(b(100n));
    expect(0).eq(await veSOS.balanceOf(alice.address));
    expect(value).eq(await SOS.balanceOf(alice.address));

    await advance(MONTH * 5);

    value = await predictLeave(e(100n));
    await veSOS.connect(bob).leave(b(100n));
    expect(0).eq(await veSOS.balanceOf(bob.address));
    expect(value).eq(await SOS.balanceOf(bob.address));

    value = await predictLeave(e(100n));
    await veSOS.connect(charlie).leave(b(100n));
    expect(0).eq(await veSOS.balanceOf(charlie.address));
    expect(value).eq(await SOS.balanceOf(charlie.address));

    expect(0).eq(await veSOS.getSOSPool());
    expect(0n).eq(await getSOSPoolTS());
  });

  it("after faucet with addReward", async () => {
    await init(now + DAY, DAY);
    await depositSOS(owner, e(1000n));
    await veSOS.connect(owner).addRewardSOS(e(1000n));
    await advance(YEAR);

    expect(e(1000n)).eq(await veSOS.getSOSPool());

    await depositSOS(alice, 100n);
    await depositSOS(bob, 100n);

    let value = await predictEneter(e(100n));
    await veSOS.connect(alice).enter(e(100n));
    expect(e(1100n)).eq(await veSOS.getSOSPool());
    expect(value).eq(await veSOS.balanceOf(alice.address));

    // bob predict
    value = await predictEneter(e(100n));
    await veSOS.connect(bob).enter(e(100n));
    expect(value).eq(await veSOS.balanceOf(bob.address));

    expect(e(1200n)).eq(await veSOS.getSOSPool());

    await advance(MONTH);

    let share = await veSOS.balanceOf(bob.address);
    value = await predictLeave(b2e(share));
    await veSOS.connect(bob).leave(share);
    expect(value).eq(await SOS.balanceOf(bob.address));

    share = await veSOS.balanceOf(alice.address);
    value = await predictLeave(b2e(share));
    await veSOS.connect(alice).leave(share);
    expect(value).eq(await SOS.balanceOf(alice.address));
  });

  it("before faucet with contribution", async () => {
    await init(now + YEAR, YEAR);
    await depositSOS(alice, 100n);
    await depositSOS(owner, 100000n);
    await SOS.mintTo(veSOS.address, b(100n));
    expect(e(100n)).eq(await veSOS.getSOSPool());

    let value = await predictEneter(e(100n));
    await veSOS.connect(alice).enter(e(100n));
    expect(e(200n)).eq(await veSOS.getSOSPool());
    expect(0).eq(await SOS.balanceOf(alice.address));
    expect(value).eq(await veSOS.balanceOf(alice.address));

    value = await predictLeave(e(100n));
    await veSOS.connect(alice).leave(e(100n));
    expect(value).eq(await SOS.balanceOf(alice.address));
    expect(0).eq(await veSOS.balanceOf(alice.address));
    expect(0).eq(await veSOS.getSOSPool());

    // alice + bob

    await depositSOS(bob, 100n);
    await veSOS.connect(alice).enter(e(200n));

    // predict bob
    value = await predictEneter(e(100n));
    await veSOS.connect(bob).enter(e(100n));
    expect(value).eq(await veSOS.balanceOf(bob.address));

    await SOS.mintTo(veSOS.address, b(300n));

    const aliceShare = await veSOS.balanceOf(alice.address);
    const bobShare = await veSOS.balanceOf(bob.address);
    expect(e(200n)).eq(aliceShare);
    expect(e(100n)).eq(bobShare);

    expect(e(600n)).eq(await veSOS.getSOSPool());
    await advance(MONTH);

    value = await predictLeave(b2e(aliceShare));
    await veSOS.connect(alice).leave(aliceShare);
    expect(0).eq(await veSOS.balanceOf(alice.address));
    expect(value).eq(await SOS.balanceOf(alice.address));

    value = await predictLeave(b2e(bobShare));
    await veSOS.connect(bob).leave(bobShare);
    expect(0).eq(await veSOS.balanceOf(bob.address));
    expect(value).eq(await SOS.balanceOf(bob.address));

    expect(0).eq(await veSOS.getSOSPool());
  });

  it("without any injection of sos", async () => {
    async function f() {
      await depositSOS(alice, 100n);
      await depositSOS(bob, 100n);
      await depositSOS(charlie, 100n);

      const value = await predictEneter(e(100n));
      await veSOS.connect(alice).enter(e(100n));
      await veSOS.connect(bob).enter(e(100n));
      await veSOS.connect(charlie).enter(e(100n));

      expect(0).eq(await SOS.balanceOf(alice.address));
      expect(0).eq(await SOS.balanceOf(bob.address));
      expect(0).eq(await SOS.balanceOf(charlie.address));

      expect(e(100n)).eq(await veSOS.balanceOf(alice.address));
      expect(e(100n)).eq(await veSOS.balanceOf(bob.address));
      expect(e(100n)).eq(await veSOS.balanceOf(charlie.address));
      expect(value).eq(await veSOS.balanceOf(alice.address));
      expect(value).eq(await veSOS.balanceOf(bob.address));
      expect(value).eq(await veSOS.balanceOf(charlie.address));

      await expect(veSOS.connect(alice).leave(0)).to.be.revertedWith("OpenDAOStaking: Should at least unstake something");

      const leave = await predictLeave(e(100n));

      await veSOS.connect(alice).leave(e(100n));
      await veSOS.connect(bob).leave(e(100n));
      await veSOS.connect(charlie).leave(e(100n));

      expect(leave).eq(await SOS.balanceOf(alice.address));
      expect(leave).eq(await SOS.balanceOf(bob.address));
      expect(leave).eq(await SOS.balanceOf(charlie.address));
      expect(e(100n)).eq(await SOS.balanceOf(alice.address));
      expect(e(100n)).eq(await SOS.balanceOf(bob.address));
      expect(e(100n)).eq(await SOS.balanceOf(charlie.address));

      expect(0).eq(await veSOS.balanceOf(alice.address));
      expect(0).eq(await veSOS.balanceOf(bob.address));
      expect(0).eq(await veSOS.balanceOf(charlie.address));
    }

    await init(now + HOUR, HOUR);
    await veSOS.setblockTime(now);
    await f();

    await init(now - MINUTE * 30, HOUR);
    await veSOS.setblockTime(now);
    await f();

    await init(now - HOUR * 2, HOUR);
    await veSOS.setblockTime(now);
    await f();
  });
});
