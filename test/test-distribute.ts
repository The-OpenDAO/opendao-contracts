import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { MyERC20 } from "../typechain";

async function setupContract(sos: string, treasure: string) {
  const distributeFactory = await ethers.getContractFactory("OpenDAOWLDistribute");
  const distribute = await distributeFactory.deploy(sos, treasure);
  await distribute.deployed();
  return distribute;
}

describe("OpenDAOWLDistribute", function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let david: SignerWithAddress;
  let eric: SignerWithAddress;
  let sos: MyERC20;

  before(async function () {
    [owner, alice, bob, charlie, david, eric] = await ethers.getSigners();
    sos = await (await ethers.getContractFactory("MyERC20")).connect(owner).deploy("SOS");
  });

  it("happy path", async function test() {
    const distribute = await setupContract(sos.address, charlie.address);
    await distribute.addProject("testProjectName1", {totalSupply: 1000, price: 5000, totalBought: 0, startBlock:0, startTime: 1649227867, endTime: 2649227867, isEnabled: true});
    await distribute.addProject("testProjectName2", {totalSupply: 1000, price: 5000, totalBought: 0, startBlock:0, startTime: 1649227867, endTime: 2649227867, isEnabled: true});
    let pid1 = 1;
    let pid2 = 2;

    await sos.connect(alice).approve(distribute.address, 30000n * 1000000000000000000n);
    await sos.connect(alice).mint(30000n*1000000000000000000n);
    await sos.connect(bob).approve(distribute.address, 50000n * 1000000000000000000n);
    await sos.connect(bob).mint(50000n*1000000000000000000n);
    
    expect(await sos.balanceOf(alice.address)).eq(30000n * 1000000000000000000n);
    expect(await sos.balanceOf(bob.address)).eq(50000n * 1000000000000000000n);

    await expect(distribute.connect(alice).requestWL(pid1))
        .to.emit(distribute, 'RequestWL')
        .withArgs(alice.address, pid1, 4500n * 1000000000000000000n, 500n * 1000000000000000000n);
    await expect(distribute.connect(bob).requestWL(pid1))
        .to.emit(distribute, 'RequestWL')
        .withArgs(bob.address, pid1, 4500n * 1000000000000000000n, 500n * 1000000000000000000n);
    await expect(distribute.connect(bob).requestWL(pid2))
        .to.emit(distribute, 'RequestWL')
        .withArgs(bob.address, pid2, 4500n * 1000000000000000000n, 500n * 1000000000000000000n);

    const project = await distribute.projects(pid1);
    expect(project.totalSupply).eq(1000);
    expect(project.totalBought).eq(2);
    expect(await sos.balanceOf(alice.address)).eq(25000n * 1000000000000000000n);
    expect(await sos.balanceOf(bob.address)).eq(40000n * 1000000000000000000n);
    expect(await sos.balanceOf(charlie.address)).eq(1500n * 1000000000000000000n); //10% goto treasure wallet
  });

  it("project not enabled", async function test() {
    const distribute = await setupContract(sos.address, charlie.address);
    await distribute.addProject("testProjectName", {totalSupply: 1000, price: 5000, totalBought: 0, startBlock:0, startTime: 1649227867, endTime: 2649227867, isEnabled: false});
    await expect(distribute.connect(alice).requestWL(1)).to.be.revertedWith("NotEnabled");
  });

  it("exceed max per wallet", async function test() {
    const distribute = await setupContract(sos.address, charlie.address);
    await distribute.addProject("testProjectName", {totalSupply: 1000, price: 5000, totalBought: 0, startBlock:0, startTime: 1649227867, endTime: 2649227867, isEnabled: true});
    await sos.connect(alice).approve(distribute.address, 10000n*1000000000000000000n);
    await sos.connect(alice).mint(10000n*1000000000000000000n);
    await distribute.connect(alice).requestWL(1);
    await expect(distribute.connect(alice).requestWL(1)).to.be.revertedWith("AlreadyWhitelisted");
  });

  it("invalid project", async function test() {
    const distribute = await setupContract(sos.address, charlie.address);
    await distribute.addProject("testProjectName", {totalSupply: 1000, price: 5000, totalBought: 0, startBlock:0, startTime: 2649227867, endTime: 2649227867, isEnabled: true});
    await expect(distribute.toggleEnable(0)).to.be.revertedWith("InvalidProject");
  });
});
