import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { MyERC20 } from "../typechain";

async function setupContract(sos: string, treasure: string) {
  const sellerFactory = await ethers.getContractFactory("OpenDAOWLSeller");
  const seller = await sellerFactory.deploy(sos, treasure);
  await seller.deployed();
  return seller;
}

describe("OpenDAOWLSeller", function () {
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
    const seller = await setupContract(sos.address, charlie.address);
    await seller.addProject(1000, 5000, 1, "testProjectName1");
    await seller.addProject(1000, 5000, 1, "testProjectName2");
    let pid1 = await seller.getProjectID("testProjectName1");
    let pid2 = await seller.getProjectID("testProjectName2");
    await seller.toggleEnable(pid1);
    await seller.toggleEnable(pid2);

    await sos.connect(alice).approve(seller.address, 30000n * 1000000000000000000n);
    await sos.connect(alice).mint(30000n*1000000000000000000n);
    await sos.connect(bob).approve(seller.address, 50000n * 1000000000000000000n);
    await sos.connect(bob).mint(50000n*1000000000000000000n);
    
    expect(await sos.balanceOf(alice.address)).eq(30000n * 1000000000000000000n);
    expect(await sos.balanceOf(bob.address)).eq(50000n * 1000000000000000000n);

    await expect(seller.connect(alice).buyWL(pid1, 1))
        .to.emit(seller, 'BuyWL')
        .withArgs(alice.address, 1, pid1);
    await expect(seller.connect(bob).buyWL(pid1, 1))
        .to.emit(seller, 'BuyWL')
        .withArgs(bob.address, 1, pid1);
    await expect(seller.connect(bob).buyWL(pid2, 1))
        .to.emit(seller, 'BuyWL')
        .withArgs(bob.address, 1, pid2);

    const project = await seller.projects(pid1);
    expect(project.totalSupply).eq(1000);
    expect(project.totalBought).eq(2);
    expect(await sos.balanceOf(alice.address)).eq(25000n * 1000000000000000000n);
    expect(await sos.balanceOf(bob.address)).eq(40000n * 1000000000000000000n);
    expect(await sos.balanceOf(charlie.address)).eq(1500n * 1000000000000000000n); //10% goto treasure wallet
  });

  it("sale not enabled", async function test() {
    const seller = await setupContract(sos.address, charlie.address);
    await seller.addProject(1000, 5000, 1, "testProjectName");
    await expect(seller.connect(alice).buyWL(1, 2)).to.be.revertedWith("SaleNotEnabled");
  });

  it("exceed max per wallet", async function test() {
    const seller = await setupContract(sos.address, charlie.address);
    await seller.addProject(1000, 5000, 1, "testProjectName");
    await seller.toggleEnable(1);
    await sos.connect(alice).approve(seller.address, 10000n*1000000000000000000n);
    await sos.connect(alice).mint(10000n*1000000000000000000n);
    await seller.connect(alice).buyWL(1, 1);
    await expect(seller.connect(alice).buyWL(1, 1)).to.be.revertedWith("ExeceedMaxPerWallet");
  });

  it("invalid project", async function test() {
    const seller = await setupContract(sos.address, charlie.address);
    await seller.addProject(1000, 5000, 1, "testProjectName");
    await expect(seller.toggleEnable(0)).to.be.revertedWith("InvalidProject");
  });

  it("duplicate project name", async function test() {
    const seller = await setupContract(sos.address, charlie.address);
    await seller.addProject(1000, 5000, 1, "testProjectName");
    await expect(seller.addProject(1000, 5000, 1, "testProjectName")).to.be.revertedWith("DuplicateProjectName");
  });
});
