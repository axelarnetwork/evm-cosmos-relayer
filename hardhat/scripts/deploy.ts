import { ethers } from "hardhat";
import { chain } from "../constant";

async function main() {
  const MultiSend = await ethers.getContractFactory("MultiSend");
  const multiSend = await MultiSend.deploy(
    chain.gateway,
    ethers.constants.AddressZero
  );
  await multiSend.deployed();

  console.log("MultiSend deployed to:", multiSend.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
