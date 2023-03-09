import { GMPListenerClient, AxelarClient, EvmClient } from './clients';
import { config } from './config';
import { Subject, filter } from 'rxjs';
import {
  ContractCallSubmitted,
  ContractCallWithTokenSubmitted,
  EvmEvent,
  IBCEvent,
  IBCPacketEvent,
} from './types';
import {
  ContractCallEventObject,
  ContractCallApprovedEventObject,
  ContractCallWithTokenEventObject,
  ContractCallApprovedWithMintEventObject,
} from './types/contracts/IAxelarGateway';
import {
  handleAnyError,
  handleEvmToCosmosCompleteEvent,
  handleCosmosToEvmCallContractWithTokenCompleteEvent,
  handleCosmosToEvmContractCallEvent,
  handleEvmToCosmosEvent,
  prepareHandler,
  handleCosmosToEvmCallContractCompleteEvent,
  handleCosmosToEvmContractCallWithTokenEvent,
} from './handler';
import { initServer } from './api';
import { logger } from './logger';

// Create an event subject for listening the ContractCallWithToken event at the gateway contract
const evmWithTokenObservable = new Subject<
  EvmEvent<ContractCallWithTokenEventObject>
>();

// Create an event subject for listening the ContractCall event at the gateway contract
const evmContractCallObservable = new Subject<
  EvmEvent<ContractCallEventObject>
>();

// Create an event subject for listening the ContractCallWithToken approval event at the gateway contract
const evmApproveWithTokenObservable = new Subject<
  EvmEvent<ContractCallApprovedWithMintEventObject>
>();

// Create an event subject for listening the ContractCall approval event at the gateway contract
const evmApproveObservable = new Subject<
  EvmEvent<ContractCallApprovedEventObject>
>();

// Create an event subject for listening the ContractCall event at Axelar network
const cosmosContractCallObservable = new Subject<
  IBCEvent<ContractCallSubmitted>
>();

// Create an event subject for listening the ContractCallWithToken event at Axelar network
const cosmosContractCallWithTokenObservable = new Subject<
  IBCEvent<ContractCallWithTokenSubmitted>
>();

// Create an event subject for listening to the IBC packet event
const cosmosCompleteObservable = new Subject<IBCPacketEvent>();

async function main() {
  const evm = config.evm['goerli'];
  const observedDestinationChains = [config.cosmos.osmosis.chainId];
  const listener = new GMPListenerClient(evm.rpcUrl, evm.gateway);
  const evmClient = new EvmClient(evm);
  const axelarClient = await AxelarClient.init(config.cosmos.testnet);
  const osmoClient = await AxelarClient.init(config.cosmos.osmosis);

  /** ######## Handle events ########## */

  // Subscribe to the ContractCallWithToken event at the gateway contract (EVM -> Cosmos direction)
  evmWithTokenObservable
    .pipe(
      filter((event) =>
        observedDestinationChains.includes(event.args.destinationChain)
      )
    )
    .subscribe((event) => {
      prepareHandler(event, 'handleEvmToCosmosEvent')
        .then(() => handleEvmToCosmosEvent(axelarClient, event))
        .catch((e) => handleAnyError('handleEvmToCosmosEvent', e));
    });

  // Subscribe to the IBCComplete event at the axelar network. (EVM -> Cosmos direction)
  // This mean the gmp flow is completed.
  cosmosCompleteObservable.subscribe((event) => {
    prepareHandler(event, 'handleEvmToCosmosCompleteEvent')
      .then(() => handleEvmToCosmosCompleteEvent(osmoClient, event))
      .catch((e) => handleAnyError('handleEvmToCosmosCompleteEvent', e));
  });

  // Subscribe to the ContractCall event at the axelar network. (Cosmos -> EVM direction)
  cosmosContractCallObservable.subscribe((event) => {
    prepareHandler(event, 'handleCosmosToEvmEvent')
      .then(() =>
        handleCosmosToEvmContractCallEvent(axelarClient, evmClient, event)
      )
      .catch((e) => handleAnyError('handleCosmosToEvmEvent', e));
  });

  // Subscribe to the ContractCallWithToken event at the axelar network. (Cosmos -> EVM direction)
  cosmosContractCallWithTokenObservable.subscribe((event) => {
    prepareHandler(event, 'handleCosmosToEvmEvent')
      .then(() =>
        handleCosmosToEvmContractCallWithTokenEvent(
          axelarClient,
          evmClient,
          event
        )
      )
      .catch((e) => handleAnyError('handleCosmosToEvmEvent', e));
  });

  // Subscribe to the ContractCallApprovedWithMint event at the gateway contract. (Cosmos -> EVM direction)
  evmApproveWithTokenObservable.subscribe((event) => {
    prepareHandler(event, 'handleCosmosToEvmCompleteEvent')
      .then(() =>
        handleCosmosToEvmCallContractWithTokenCompleteEvent(evmClient, event)
      )
      .catch((e) => handleAnyError('handleCosmosToEvmCompleteEvent', e));
  });

  // Subscribe to the ContractCallApproved event at the gateway contract. (Cosmos -> EVM direction)
  evmApproveObservable.subscribe((event) => {
    prepareHandler(event, 'handleCosmosToEvmCompleteEvent')
      .then(() => handleCosmosToEvmCallContractCompleteEvent(evmClient, event))
      .catch((e) => handleAnyError('handleCosmosToEvmCompleteEvent', e));
  });

  // ########## Listens for events ##########

  // listen for events on cosmos and evm
  listener.listenEVM(
    evmWithTokenObservable,
    evmApproveWithTokenObservable,
    evmApproveObservable
  );
  axelarClient.listenForCosmosGMP(cosmosContractCallObservable);
  axelarClient.listenForIBCComplete(cosmosCompleteObservable);
}

logger.info('Starting relayer server...');
initServer();

// handle error globally
main();
