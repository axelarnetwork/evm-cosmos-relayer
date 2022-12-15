import GatewayAbi from "../abi/IAxelarGateway.abi.json";
import { ethers } from "ethers";

export class GMPListenerClient {
  gatewayContract: ethers.Contract;

  constructor(rpcUrl: string, gateway: string) {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.gatewayContract = new ethers.Contract(gateway, GatewayAbi, provider);
  }

  private listenCallContractWithToken() {
    this.gatewayContract.on("ContractCallWithToken", (data: any) => {
      console.log("received gmp:", data);
    });
  }

  public listenEVM() {
    // clear all listeners before subscribe a new one.
    this.gatewayContract.removeAllListeners();

    this.listenCallContractWithToken();
  }
}
