/* eslint-disable prettier/prettier */
/* eslint-disable no-process-exit */
/* eslint-disable node/no-missing-import */
/* eslint-disable node/no-unpublished-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@typechain/hardhat";
import { readFileSync, writeFileSync } from "fs";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const rinkeby = "rinkeby";
const goerli = "goerli";
const mainnet = "mainnet";
const mumbai = "mumbai";
const polygon = "polygon";

export function getENV(hre: HardhatRuntimeEnvironment, varName: string): string {
  let ret;
  switch (hre.network.name) {
    case rinkeby:
      ret = process.env[(rinkeby + "_" + varName).toUpperCase()] || "";
      break;
    case goerli:
      ret = process.env[(goerli + "_" + varName).toUpperCase()] || "";
      break;
    case mainnet:
      ret = process.env[(mainnet + "_" + varName).toUpperCase()] || "";
      break;
    case mumbai:
      ret = process.env[(mumbai + "_" + varName).toUpperCase()] || "";
      break;
    case polygon:
      ret = process.env[(polygon + "_" + varName).toUpperCase()] || "";
      break;
    default:
      console.log("unknown network name, exiting...");
      process.exit(1);
  }
  return ret;
}

export function getKeys(path: string): string[] {
  const CFG = JSON.parse(readFileSync(path, "utf-8"));
  return CFG.accounts.map((i: any) => i.sk);
}

export async function getNonce(account: SignerWithAddress) {
  const path = "cache/nonces.json";
  let nonces = new Map();
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    nonces = new Map(data);
  } catch (e: any) { }

  let nonce = await account.getTransactionCount();
  const n2 = nonces.get(account.address) || 0;
  if (nonce < n2) nonce = n2;

  nonces.set(account.address, nonce + 1);
  writeFileSync(path, JSON.stringify(Array.from(nonces.entries())));
  return nonce;
}