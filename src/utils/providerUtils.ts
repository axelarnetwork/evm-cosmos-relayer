import { ethers } from "ethers";
import { config } from "../config";

export function getProvider(chain: string) {
  if (chain === "goerli") {
    return new ethers.providers.StaticJsonRpcProvider(
      config.evm["goerli"].rpcUrl
    );
  }
}
