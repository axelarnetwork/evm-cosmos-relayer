import { ethers } from 'ethers';
import { EvmNetworkConfig } from '../../config/types';
import { IAxelarGateway, IAxelarGateway__factory } from '../../types/contracts';
import { EvmListenerEvent } from './eventTypes';
import { TypedEvent } from '../../types/contracts/common';
import { EvmEvent } from '../../types';
import { Subject } from 'rxjs';
import { logger } from '../../logger';
import { env } from '../../config';

export class EvmListener {
  private gatewayContract: IAxelarGateway;
  private currentBlock = 0;
  public chainId: string;
  public finalityBlocks: number;
  public cosmosChainNames: string[];

  constructor(evm: EvmNetworkConfig, cosmosChainNames: string[]) {
    const provider = new ethers.providers.JsonRpcProvider(evm.rpcUrl);
    this.gatewayContract = IAxelarGateway__factory.connect(evm.gateway, provider);
    this.chainId = evm.id;
    this.finalityBlocks = evm.finality;
    this.cosmosChainNames = cosmosChainNames;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async listen<EventObject, Event extends TypedEvent<any, EventObject>>(
    event: EvmListenerEvent<EventObject, Event>,
    subject: Subject<EvmEvent<EventObject>>
  ) {
    logger.info(`[EVMListener] [${this.chainId}] Listening to "${event.name}" event`);

    // clear all listeners before subscribe a new one.
    this.gatewayContract.removeAllListeners();

    // update block number
    this.currentBlock = await this.gatewayContract.provider.getBlockNumber();

    const eventFilter = event.getEventFilter(this.gatewayContract);
    this.gatewayContract.on(eventFilter, async (...args) => {
      const ev: Event = args[args.length - 1];

      if (ev.blockNumber <= this.currentBlock) return;
      if (env.CHAIN_ENV === 'testnet' && !event.isAcceptedChain(this.cosmosChainNames, ev.args)) return;

      const evmEvent = await event.parseEvent(
        this.chainId,
        this.gatewayContract.provider,
        ev,
        this.finalityBlocks
      );

      subject.next(evmEvent);
    });
  }
}
