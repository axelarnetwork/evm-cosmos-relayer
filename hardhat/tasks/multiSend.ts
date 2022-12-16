import { task } from "hardhat/config";
import { cosmos } from "../constant";

task("multisend", "Send GMP tx to cosmos")
  .addPositionalParam("recipient", "Recipient address")
  .addPositionalParam("amount", "Amount")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();
    const { recipient, amount } = taskArgs;
    console.log(recipient, amount);
    const multisendAddress = "0x873424B4cf0E6AF4d8402ee05Ed7CC324307df47";

    const multiSend = await ethers.getContractAt(
      "MultiSend",
      multisendAddress,
      deployer
    );

    const destinationChain = cosmos.name;
    const destAddress = "axelar16rdjmg0ddsy6tg2m945uyj8jnltk4tpw22quxg";
    const receivers = [recipient];
    const symbol = "axlUSDA";
    const usdaAddress = "0x392B0A115101CC66241bC4180B000EaCEB8e31e3";

    const erc20 = new ethers.Contract(
      usdaAddress,
      ["function approve(address spender, uint256 amount)"],
      deployer
    );
    await erc20.approve(multiSend.address, amount).then((tx: any) => tx.wait());
    console.log("Approved");

    const tx = await multiSend.multiSend(
      destinationChain,
      destAddress,
      receivers,
      symbol,
      amount
    );

    console.log("Sent", tx.hash);
  });
