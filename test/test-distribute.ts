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
    await distribute.addProject(1000, 5000, 1, "testProjectName1");
    await distribute.addProject(1000, 5000, 1, "testProjectName2");
    let pid1 = await distribute.getProjectID("testProjectName1");
    let pid2 = await distribute.getProjectID("testProjectName2");
    await distribute.toggleEnable(pid1);
    await distribute.toggleEnable(pid2);

    await sos.connect(alice).approve(distribute.address, 30000n * 1000000000000000000n);
    await sos.connect(alice).mint(30000n*1000000000000000000n);
    await sos.connect(bob).approve(distribute.address, 50000n * 1000000000000000000n);
    await sos.connect(bob).mint(50000n*1000000000000000000n);
    
    expect(await sos.balanceOf(alice.address)).eq(30000n * 1000000000000000000n);
    expect(await sos.balanceOf(bob.address)).eq(50000n * 1000000000000000000n);

    await expect(distribute.connect(alice).requestWL(pid1, 1))
        .to.emit(distribute, 'RequestWL')
        .withArgs(alice.address, 1, pid1);
    await expect(distribute.connect(bob).requestWL(pid1, 1))
        .to.emit(distribute, 'RequestWL')
        .withArgs(bob.address, 1, pid1);
    await expect(distribute.connect(bob).requestWL(pid2, 1))
        .to.emit(distribute, 'RequestWL')
        .withArgs(bob.address, 1, pid2);

    const project = await distribute.projects(pid1);
    expect(project.totalSupply).eq(1000);
    expect(project.totalBought).eq(2);
    expect(await sos.balanceOf(alice.address)).eq(25000n * 1000000000000000000n);
    expect(await sos.balanceOf(bob.address)).eq(40000n * 1000000000000000000n);
    expect(await sos.balanceOf(charlie.address)).eq(1500n * 1000000000000000000n); //10% goto treasure wallet
  });

  it("project not enabled", async function test() {
    const distribute = await setupContract(sos.address, charlie.address);
    await distribute.addProject(1000, 5000, 1, "testProjectName");
    await expect(distribute.connect(alice).requestWL(1, 2)).to.be.revertedWith("NotEnabled");
  });

  it("exceed max per wallet", async function test() {
    const distribute = await setupContract(sos.address, charlie.address);
    await distribute.addProject(1000, 5000, 1, "testProjectName");
    await distribute.toggleEnable(1);
    await sos.connect(alice).approve(distribute.address, 10000n*1000000000000000000n);
    await sos.connect(alice).mint(10000n*1000000000000000000n);
    await distribute.connect(alice).requestWL(1, 1);
    await expect(distribute.connect(alice).requestWL(1, 1)).to.be.revertedWith("ExeceedMaxPerWallet");
  });

  it("invalid project", async function test() {
    const distribute = await setupContract(sos.address, charlie.address);
    await distribute.addProject(1000, 5000, 1, "testProjectName");
    await expect(distribute.toggleEnable(0)).to.be.revertedWith("InvalidProject");
  });

  it("duplicate project name", async function test() {
    const distribute = await setupContract(sos.address, charlie.address);
    await distribute.addProject(1000, 5000, 1, "testProjectName");
    await expect(distribute.addProject(1000, 5000, 1, "testProjectName")).to.be.revertedWith("DuplicateProjectName");
  });
});
