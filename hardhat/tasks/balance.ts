import { task } from "hardhat/config";

task("balance", "Check balance")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();

    const usdaAddress = "0x392B0A115101CC66241bC4180B000EaCEB8e31e3";

    const erc20 = new ethers.Contract(
      usdaAddress,
      ["function balanceOf(address account) public view returns (uint256)"],
      deployer
    );

    console.log(await erc20.balanceOf(deployer.address))
  });
