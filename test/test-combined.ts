/* eslint-disable node/no-missing-import */
/* eslint-disable prettier/prettier */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { OpenDAOCombined, MyERC20, MasterChefV2Mock } from "../typechain";
import { timestampInSecond } from "../utils/timestamp";
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

let sos: MyERC20;
let sosWETHPair: MyERC20;
let combined: OpenDAOCombined;
let chef: MasterChefV2Mock;

function b(amount: bigint): BigNumber { return utils.parseEther(amount.toString()) }

async function init() {
  expect(31337).eq((await provider.getNetwork()).chainId);
  [owner, alice, bob, charlie, david] = await ethers.getSigners();

  const MyERC20Factory = await ethers.getContractFactory("MyERC20");
  sos = await MyERC20Factory.connect(owner).deploy("SOS");
  sosWETHPair = await MyERC20Factory.connect(owner).deploy("sosWETHPair");

  const factoryMasterChefV2Mock = await ethers.getContractFactory("MasterChefV2Mock");
  chef = await factoryMasterChefV2Mock.connect(owner).deploy();

  const factory = await ethers.getContractFactory("OpenDAOCombined");
  combined = await factory.connect(owner).deploy();
}

async function addLiquidity(account: SignerWithAddress, amount: BigNumber) {
    // deposit sos
    await sos.connect(account).transfer(sosWETHPair.address, amount);
    // received slp
    await sosWETHPair.connect(account).mint(amount);
}

async function stake(account: SignerWithAddress, amount: BigNumber) {
  await sosWETHPair.connect(account).transfer(chef.address, amount);
  await chef.setLP(alice.address, amount);
}

/*
npx hardhat test test/test-combined.ts
*/
describe("test-combined.ts", function () {
  it("test", async () => {
    await init();
    expect(0).eq(await combined.getSupply(sos.address, sosWETHPair.address));
   
    await sos.connect(alice).mint(b(200n));
    await addLiquidity(alice, b(100n));
    await stake(alice, b(50n));

    await sos.connect(bob).mint(b(200n));
    await addLiquidity(bob, b(100n));
    await stake(bob, b(50n));

    await sos.connect(charlie).mint(b(200n));
    await addLiquidity(charlie, b(100n));

    await sos.connect(david).mint(b(200n));

    expect(b(800n + 300n)).eq(await combined.getSupply(sos.address, sosWETHPair.address));

    expect(await getBlance(alice)).eq(await combined.getBalance(alice.address, chef.address, sos.address, sosWETHPair.address));
    expect(await getBlance(bob)).eq(await combined.getBalance(bob.address, chef.address, sos.address, sosWETHPair.address));
    expect(await getBlance(charlie)).eq(await combined.getBalance(charlie.address, chef.address, sos.address, sosWETHPair.address));
    expect(await getBlance(david)).eq(await combined.getBalance(david.address, chef.address, sos.address, sosWETHPair.address));
  });
});

async function getBlance(account:SignerWithAddress) {
  const lpBalance = (await chef.userInfo(45, account.address))[0].add(await sosWETHPair.balanceOf(account.address));
  const lpAdjustedBalance = lpBalance.mul((await sos.balanceOf(sosWETHPair.address)).div(await sosWETHPair.totalSupply())).mul(2)
  const sosBalance = await sos.balanceOf(account.address);
  return sosBalance.add(lpAdjustedBalance);
}
