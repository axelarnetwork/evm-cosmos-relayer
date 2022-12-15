import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
// import "@nomicfoundation/hardhat-toolbox";
import { chain } from "./constant";

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  defaultNetwork: "ganache0",
  networks: {
    ganache0: {
      chainId: 1337,
      gasMultiplier: 2,
      url: chain.rpcUrl,
      accounts: [chain.privateKey],
    },
  },
};

export default config;
