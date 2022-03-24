import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { MyERC20 } from "../typechain";

async function setupContract(sos: address, treasure: address) {
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

  it("exceed max per wallet", async function test() {
    const seller = await setupContract(sos, alice.address);
    await seller.addProject(1000, 5000);
    await seller.toggleEnable(0);
    await expect(seller.connect(alice).buyWL(0, 2, { value: ethers.utils.parseEther("0.02")}))
    .to.be.revertedWith("EXCEEDS_MAX_OG_MINT");
  });

});
