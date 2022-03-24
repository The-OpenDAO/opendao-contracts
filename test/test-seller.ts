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

  it("sale not enabled", async function test() {
    const seller = await setupContract(sos.address, alice.address);
    await seller.addProject(1000, 5000);
    await expect(seller.connect(alice).buyWL(0, 2)).to.be.revertedWith("SaleNotEnabled");
  });

  it("happy path", async function test() {
    const seller = await setupContract(sos.address, alice.address);
    await seller.addProject(1000, 5000);
    await seller.toggleEnable(0);
    await sos.connect(alice).approve(seller.address, 10000n*1000000000000000000n);
    await sos.connect(alice).mint(10000n*1000000000000000000n);
    await seller.connect(alice).buyWL(0, 1);
  });

});
