import { GMPListenerClient, AxelarClient, EvmClient } from './clients';
import { config } from './config';
import { Subject, filter } from 'rxjs';
import { EvmEvent, IBCEvent, IBCPacketEvent } from './types';
import {
  ContractCallApprovedWithMintEventObject,
  ContractCallWithTokenEventObject,
} from './types/contracts/IAxelarGateway';
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
  const observedEvmChains = [config.evm.avax, config.evm.goerli];
  const observedCosmosChains = [config.cosmos.osmosis.chainId];

  const evmListeners = observedEvmChains.map(
    (evm) => new GMPListenerClient(evm.rpcUrl, evm.gateway)
  );
  const evmClients = observedEvmChains.map((evm) => new EvmClient(evm));

  const axelarClient = await AxelarClient.init(config.cosmos.testnet);
  const osmoClient = await AxelarClient.init(config.cosmos.osmosis);

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

  // Handle for `CallContract` and `CallContractWithTokens` events from evm chains to cosmos chains.
  evmWithTokenObservable
    .pipe(
      filter((event) =>
        observedCosmosChains.includes(event.args.destinationChain)
      )
    )
    .subscribe((event) => {
      prepareHandler(event, 'handleEvmToCosmosEvent')
        .then(() => handleEvmToCosmosEvent(axelarClient, event))
        .catch((e) => handleAnyError('handleEvmToCosmosEvent', e));
    });

  evmClients.forEach((evmClient) => {
    // Handle for `ContractCallApproved` and `ContractCallApprovedWithMint` events on evm chains.
    evmApproveWithTokenObservable.subscribe((event) => {
      prepareHandler(event, 'handleCosmosToEvmCompleteEvent')
        .then(() => handleCosmosToEvmCompleteEvent(evmClient, event))
        .catch((e) => handleAnyError('handleCosmosToEvmCompleteEvent', e));
    });

    // Handle for `GeneralMessageApprovedWithToken` events on cosmos chains.
    cosmosWithTokenObservable.subscribe((event) => {
      prepareHandler(event, 'handleCosmosToEvmEvent')
        .then(() => handleCosmosToEvmEvent(axelarClient, evmClient, event))
        .catch((e) => handleAnyError('handleCosmosToEvmEvent', e));
    });
  });

  // Handle for `IBCPacketComplete` events on cosmos chains.
  cosmosCompleteObservable.subscribe((event) => {
    prepareHandler(event, 'handleEvmToCosmsCompleteEvent')
      .then(() => handleEvmToCosmosCompleteEvent(osmoClient, event))
      .catch((e) => handleAnyError('handleEvmToCosmosCompleteEvent', e));
  });

  // Listens for events on evm chains.
  evmListeners.forEach((listener) => {
    listener.listenEVM(evmWithTokenObservable, evmApproveWithTokenObservable);
  });

  axelarClient.listenForCosmosGMP(cosmosWithTokenObservable);
  axelarClient.listenForIBCComplete(cosmosCompleteObservable);
}

logger.info('Starting relayer server...');
initServer();

// handle error globally
main();
