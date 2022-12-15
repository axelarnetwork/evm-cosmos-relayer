import { getProvider } from "../utils/providerUtils";
import { config } from "../config";
import GatewayAbi from "../abi/IAxelarGateway.abi.json";
import { ethers } from "ethers";

export class GMPListenerClient {
  public listenCallContractWithToken() {}

  public listenEVM(chain: string) {
    if (chain !== "ganache-0") {
      return console.log("chain not supported");
    }

    const _chain = config.evm;
    const provider = getProvider(chain);

    // initialize the gateway contract
    const contract = new ethers.Contract(
      _chain["ganache-0"].gateway,
      GatewayAbi,
      provider
    );

    // listen for the event
    contract.on("CallContractWithToken", (data: any) => {
      console.log(data);
    });
  }
}
