import "dotenv/config";
import { CosmosNetworkConfig } from "./types";

const demo: CosmosNetworkConfig = {
  mnemonic: process.env.MNEMONIC || "",
  chainId: "demo-chain",
  denom: "uvx",
  rpcUrl:
    "http://a1b287720a05545eb8e2f6c769a1af6b-1437958231.us-east-2.elb.amazonaws.com:26657",
  lcdUrl:
    "http://a1b287720a05545eb8e2f6c769a1af6b-1437958231.us-east-2.elb.amazonaws.com:1317",
};

const devnet: CosmosNetworkConfig = {
  mnemonic: process.env.MNEMONIC || "",
  chainId: "devnet-vx",
  denom: "uvx",
  rpcUrl:
    "http://a84bc226b379f4142928245039a11d4a-1282067752.us-east-2.elb.amazonaws.com:26657",
  lcdUrl:
    "http://a84bc226b379f4142928245039a11d4a-1282067752.us-east-2.elb.amazonaws.com:1317",
};

export const config = {
  demo,
  devnet,
};
