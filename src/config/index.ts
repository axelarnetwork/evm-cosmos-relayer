import "dotenv/config";
import { CosmosNetworkConfig, EvmNetworkConfig } from "./types";

const demo: CosmosNetworkConfig = {
  mnemonic: process.env.AXELAR_MNEMONIC || "",
  chainId: "demo-chain",
  denom: "udemo",
  rpcUrl:
    "http://a1b287720a05545eb8e2f6c769a1af6b-1437958231.us-east-2.elb.amazonaws.com:26657",
  lcdUrl:
    "http://a1b287720a05545eb8e2f6c769a1af6b-1437958231.us-east-2.elb.amazonaws.com:1317",
  ws: "ws://a1b287720a05545eb8e2f6c769a1af6b-1437958231.us-east-2.elb.amazonaws.com:26657/websocket"
};

const devnet: CosmosNetworkConfig = {
  mnemonic: process.env.AXELAR_MNEMONIC || "",
  chainId: "devnet-vx",
  denom: "uvx",
  rpcUrl:
    "http://a84bc226b379f4142928245039a11d4a-1282067752.us-east-2.elb.amazonaws.com:26657",
  lcdUrl:
    "http://a84bc226b379f4142928245039a11d4a-1282067752.us-east-2.elb.amazonaws.com:1317",
  ws: "ws://a84bc226b379f4142928245039a11d4a-1282067752.us-east-2.elb.amazonaws.com:26657/websocket"
};

const ganache0: EvmNetworkConfig = {
  name: "ganache-0",
  privateKey: process.env.EVM_PRIVATE_KEY || "",
  rpcUrl:
    "http://a087b4719fc8944a0952490cf1020812-853925870.us-east-2.elb.amazonaws.com:7545",
  gateway: "0xE720c5C38028Ca08DA47E179162Eca2DD255B6eC",
};

export const config = {
  cosmos: {
    demo,
    devnet,
  },
  evm: {
    "ganache-0": ganache0,
  },
};
