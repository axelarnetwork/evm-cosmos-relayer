import { ethers } from "ethers";
import { Subject } from "rxjs";
import {
  IAxelarGatewayAbi__factory,
  IAxelarGatewayAbi,
} from "../types/contracts/index";
export { ContractCallWithTokenEventObject } from "../types/contracts/IAxelarGatewayAbi";
import { ContractCallWithTokenListenerEvent } from "../types/filteredEvents";
import { filterEventArgs } from "../utils/filterUtils";

export class GMPListenerClient {
  gatewayContract: IAxelarGatewayAbi;
  private targetChains = ["demo-chain"];

  constructor(rpcUrl: string, gateway: string) {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.gatewayContract = IAxelarGatewayAbi__factory.connect(
      gateway,
      provider
    );
  }

  private async listenCallContractWithToken(
    subject: Subject<ContractCallWithTokenListenerEvent>
  ) {
    const filter = this.gatewayContract.filters.ContractCallWithToken(
      null,
      null,
      null,
      null,
      null,
      null
    );
    this.gatewayContract.on(filter, (...args) => {
      const event = args[7];
      subject.next({
        hash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        args: filterEventArgs(event),
      });
    });
  }

  public listenEVM(subject: Subject<ContractCallWithTokenListenerEvent>) {
    // clear all listeners before subscribe a new one.
    this.gatewayContract.removeAllListeners();
    this.listenCallContractWithToken(subject);
  }
}
