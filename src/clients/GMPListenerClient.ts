import { ethers } from 'ethers';
import { Subject } from 'rxjs';
import {
  IAxelarGateway__factory,
  IAxelarGateway,
} from '../types/contracts/index';
export {
  ContractCallWithTokenEventObject,
  ContractCallApprovedWithMintEventObject,
} from '../types/contracts/IAxelarGateway';
import { EvmEvent } from '../types';
import { filterEventArgs } from '../utils/filterUtils';
import { ContractCallWithTokenEventObject } from '.';
import { ContractCallApprovedWithMintEventObject } from '../types/contracts/IAxelarGatewayAbi';

export class GMPListenerClient {
  gatewayContract: IAxelarGateway;
  private currentBlock = 0;
  private targetChains = ['demo-chain'];

  constructor(rpcUrl: string, gateway: string) {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.gatewayContract = IAxelarGateway__factory.connect(gateway, provider);
  }

  private async listenCallContractWithToken(
    subject: Subject<EvmEvent<ContractCallWithTokenEventObject>>
  ) {
    const filter = this.gatewayContract.filters.ContractCallWithToken(
      null,
      null,
      null,
      null,
      null,
      null
    );
    // const events = await this.gatewayContract.queryFilter(filter, 0, "latest");
    // events.forEach((event) => {
    //   console.log(event.args.destinationChain);
    // });

    this.gatewayContract.on(filter, (...args) => {
      const event = args[7];
      if (event.blockNumber <= this.currentBlock) return;

      subject.next({
        hash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        args: filterEventArgs(event),
      });
    });
  }

  private async listenCallContractWithTokenApprove(
    subject: Subject<EvmEvent<ContractCallApprovedWithMintEventObject>>
  ) {
    const filter = this.gatewayContract.filters.ContractCallApprovedWithMint();
    this.gatewayContract.on(filter, (...args) => {
      const event = args[9];
      if (event.blockNumber <= this.currentBlock) return;

      subject.next({
        hash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        args: filterEventArgs(event),
      });
    });
  }

  public async listenEVM(
    contractCallWithTokenEventSubject: Subject<
      EvmEvent<ContractCallWithTokenEventObject>
    >,
    contractCallApprovedWithMintEventSubject: Subject<
      EvmEvent<ContractCallApprovedWithMintEventObject>
    >
  ) {
    // clear all listeners before subscribe a new one.
    this.gatewayContract.removeAllListeners();

    // update block number
    this.currentBlock = await this.gatewayContract.provider.getBlockNumber();
    console.log('Current block number:', this.currentBlock);

    this.listenCallContractWithToken(contractCallWithTokenEventSubject);

    this.listenCallContractWithTokenApprove(
      contractCallApprovedWithMintEventSubject
    );
  }
}
