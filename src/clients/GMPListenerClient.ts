import { ethers } from 'ethers';
import { Subject } from 'rxjs';
import {
  IAxelarGateway__factory,
  IAxelarGateway,
} from '../types/contracts/index';
import { EvmEvent } from '../types';
import { filterEventArgs } from '../utils/filterUtils';
import {
  ContractCallApprovedEventObject,
  ContractCallApprovedWithMintEventObject,
  ContractCallEventObject,
  ContractCallWithTokenEventObject,
} from '../types/contracts/IAxelarGateway';
import { logger } from '../logger';
import { EvmNetworkConfig } from '../config/types';

export class GMPListenerClient {
  private gatewayContract: IAxelarGateway;
  private currentBlock = 0;
  public chainId: string;

  constructor(evm: EvmNetworkConfig) {
    const provider = new ethers.providers.JsonRpcProvider(evm.rpcUrl);
    this.gatewayContract = IAxelarGateway__factory.connect(
      evm.gateway,
      provider
    );
    this.chainId = evm.id;
  }

  private async listenCallContract(
    subject: Subject<EvmEvent<ContractCallEventObject>>
  ) {
    const filter = this.gatewayContract.filters.ContractCall();
    this.gatewayContract.on(filter, async (...args) => {
      const event = args[5];
      if (event.blockNumber <= this.currentBlock) return;

      const receipt = await event.getTransactionReceipt();
      const index = receipt.logs.findIndex(
        (log) => log.logIndex === event.logIndex
      );

      subject.next({
        hash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: index,
        sourceChain: this.chainId,
        destinationChain: event.args.destinationChain,
        args: filterEventArgs(event),
      });
    });
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
    this.gatewayContract.on(filter, async (...args) => {
      const event = args[7];
      if (event.blockNumber <= this.currentBlock) return;

      const receipt = await event.getTransactionReceipt();
      const index = receipt.logs.findIndex(
        (log) => log.logIndex === event.logIndex
      );

      subject.next({
        hash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: index,
        sourceChain: this.chainId,
        destinationChain: event.args.destinationChain,
        args: filterEventArgs(event),
      });
    });
  }

  private async listenCallContractWithTokenApprove(
    subject: Subject<EvmEvent<ContractCallApprovedWithMintEventObject>>
  ) {
    const filter = this.gatewayContract.filters.ContractCallApprovedWithMint();
    this.gatewayContract.on(filter, async (...args) => {
      const event = args[9];
      if (event.blockNumber <= this.currentBlock) return;

      const receipt = await event.getTransactionReceipt();
      const index = receipt.logs.findIndex(
        (log) => log.logIndex === event.logIndex
      );

      subject.next({
        hash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: index,
        sourceChain: event.args.sourceChain,
        destinationChain: this.chainId,
        args: filterEventArgs(event),
      });
    });
  }

  public async listenCallContractApprove(
    subject: Subject<EvmEvent<ContractCallApprovedEventObject>>
  ) {
    const filter = this.gatewayContract.filters.ContractCallApproved();
    this.gatewayContract.on(filter, async (...args) => {
      const event = args[7];
      if (event.blockNumber <= this.currentBlock) return;

      const receipt = await event.getTransactionReceipt();
      const index = receipt.logs.findIndex(
        (log) => log.logIndex === event.logIndex
      );

      subject.next({
        hash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: index,
        sourceChain: event.args.sourceChain,
        destinationChain: this.chainId,
        args: filterEventArgs(event),
      });
    });
  }

  public async listenForEvmGMP(
    evmCallContractObservable: Subject<EvmEvent<ContractCallEventObject>>,
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
    logger.info(`chainId ${this.chainId} block number: ${this.currentBlock}`);

    // listen for ContractCall event that originates from the evm chain.
    this.listenCallContract(evmCallContractObservable);

    // listen for the ContractCallWithToken event that originates from the evm chain.
    this.listenCallContractWithToken(evmWithTokenObservable);

    // listen for the CallContractApproveWithMint event at the evm chain where it is sent from cosmos.
    this.listenCallContractWithTokenApprove(evmApproveWithTokenObservable);

    // listen for the CallContractApprove event at the evm chain where it is sent from cosmos.
    this.listenCallContractApprove(evmApproveObservable);
  }
}
