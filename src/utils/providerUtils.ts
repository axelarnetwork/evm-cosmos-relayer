import { ethers } from "ethers";
import { config } from "../config";

export function getProvider(chain: string) {
  if (chain === "ganache-0") {
    return new ethers.providers.StaticJsonRpcProvider(
      config.evm["ganache-0"].rpcUrl
    );
  }
}
