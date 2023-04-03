import { ethers } from 'ethers';
import { EvmNetworkConfig } from '../../config/types';
import { IAxelarGateway, IAxelarGateway__factory } from '../../types/contracts';
import { EvmListenerEvent } from './eventTypes';
import { TypedEvent } from '../../types/contracts/common';
import { EvmEvent } from '../../types';
import { Subject } from 'rxjs';
import { logger } from '../../logger';

export class EvmListener {
  private gatewayContract: IAxelarGateway;
  private currentBlock = 0;
  public chainId: string;
  public finalityBlocks: number;

  constructor(evm: EvmNetworkConfig) {
    const provider = new ethers.providers.JsonRpcProvider(evm.rpcUrl);
    this.gatewayContract = IAxelarGateway__factory.connect(
      evm.gateway,
      provider
    );
    this.chainId = evm.id;
    this.finalityBlocks = evm.finality;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public listen<EventObject, Event extends TypedEvent<any, EventObject>>(
    event: EvmListenerEvent<EventObject, Event>,
    subject: Subject<EvmEvent<EventObject>>
  ) {
    logger.info(
      `[EVMListener] [${this.chainId}] Subscribed to "${event.name}" event`
    );
    const filter = event.getEventFilter(this.gatewayContract);
    this.gatewayContract.on(filter, async (...args) => {
      const ev: Event = args[args.length - 1];

      if (ev.blockNumber <= this.currentBlock) return;

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
