import { GMPListenerClient, AxelarClient, EvmClient } from './clients';
import { config } from './config';
import { Subject, filter } from 'rxjs';
import { EvmEvent, IBCEvent, IBCPacketEvent } from './types';
import { ContractCallWithTokenEventObject } from './types/contracts/IAxelarGatewayAbi';
import { ContractCallApprovedWithMintEventObject } from './types/contracts/IAxelarGateway';
import {
  handleAnyError,
  handleEvmToCosmosCompleteEvent,
  handleCosmosToEvmCompleteEvent,
  handleCosmosToEvmEvent,
  handleEvmToCosmosEvent,
  prepareHandler,
} from './handler';
import { initServer } from './api';
import { logger } from './logger';

async function main() {
  const evm = config.evm['ganache-0'];
  const observedDestinationChains = [config.cosmos.demo.chainId];
  const listener = new GMPListenerClient(evm.rpcUrl, evm.gateway);
  const evmClient = new EvmClient(evm);
  const vxClient = await AxelarClient.init(config.cosmos.devnet);
  const demoClient = await AxelarClient.init(config.cosmos.demo);

  // Create an event subject for ContractCallWithTokenListenerEvent
  const evmWithTokenObservable = new Subject<
    EvmEvent<ContractCallWithTokenEventObject>
  >();
  const evmApproveWithTokenObservable = new Subject<
    EvmEvent<ContractCallApprovedWithMintEventObject>
  >();
  const cosmosWithTokenObservable = new Subject<
    IBCEvent<ContractCallWithTokenEventObject>
  >();
  const cosmosCompleteObservable = new Subject<IBCPacketEvent>();

  /** ######## Handle events ########## */
  evmWithTokenObservable
    .pipe(
      filter((event) =>
        observedDestinationChains.includes(event.args.destinationChain)
      )
    )
    .subscribe((event) => {
      prepareHandler(event, 'handleEvmToCosmosEvent')
        .then(() => handleEvmToCosmosEvent(vxClient, event))
        .catch((e) => handleAnyError('handleEvmToCosmosEvent', e));
    });

  evmApproveWithTokenObservable.subscribe((event) => {
    prepareHandler(event, 'handleCosmosToEvmCompleteEvent')
      .then(() => handleCosmosToEvmCompleteEvent(evmClient, event))
      .catch((e) => handleAnyError('handleCosmosToEvmCompleteEvent', e));
  });

  cosmosWithTokenObservable.subscribe((event) => {
    prepareHandler(event, 'handleCosmosToEvmEvent')
      .then(() => handleCosmosToEvmEvent(vxClient, evmClient, event))
      .catch((e) => handleAnyError('handleCosmosToEvmEvent', e));
  });

  cosmosCompleteObservable.subscribe((event) => {
    prepareHandler(event, 'handleEvmToCosmosCompleteEvent')
      .then(() => handleEvmToCosmosCompleteEvent(demoClient, event))
      .catch((e) => handleAnyError('handleEvmToCosmosCompleteEvent', e));
  });

  // ########## Listens for events ##########
  // listen for events on cosmos and evm
  listener.listenEVM(evmWithTokenObservable, evmApproveWithTokenObservable);
  vxClient.listenForCosmosGMP(cosmosWithTokenObservable);
  vxClient.listenForIBCComplete(cosmosCompleteObservable);
}

logger.info('Starting relayer server...');
initServer();

// handle error globally
main();
