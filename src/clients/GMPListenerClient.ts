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
import {
  ContractCallApprovedEventObject,
  ContractCallApprovedWithMintEventObject,
} from '../types/contracts/IAxelarGateway';
import { logger } from '../logger';

export class GMPListenerClient {
  gatewayContract: IAxelarGateway;
  private currentBlock = 0;

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
    //   logger.info(event.args.destinationChain);
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

  private async listenCallContractApprove(
    subject: Subject<EvmEvent<ContractCallApprovedEventObject>>
  ) {
    const filter = this.gatewayContract.filters.ContractCallApproved();
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

  public async listenEVM(
    evmWithTokenObservable: Subject<EvmEvent<ContractCallWithTokenEventObject>>,
    evmApproveWithTokenObservable: Subject<
      EvmEvent<ContractCallApprovedWithMintEventObject>
    >,
    evmApproveObservable: Subject<EvmEvent<ContractCallApprovedEventObject>>
  ) {
    // clear all listeners before subscribe a new one.
    this.gatewayContract.removeAllListeners();

    // update block number
    this.currentBlock = await this.gatewayContract.provider.getBlockNumber();
    logger.info(`Current block number: ${this.currentBlock}`);

    // listen for gmp event that originates from the evm chain.
    this.listenCallContractWithToken(evmWithTokenObservable);

    // listen for the CallContractApproveWithMint event at the evm chain where it is sent from cosmos.
    this.listenCallContractWithTokenApprove(evmApproveWithTokenObservable);

    // listen for the CallContractApprove event at the evm chain where it is sent from cosmos.
    this.listenCallContractApprove(evmApproveObservable);
  }
}
