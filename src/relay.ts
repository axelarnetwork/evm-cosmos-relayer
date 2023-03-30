import { Subject, filter } from 'rxjs';
import {
  GMPListenerClient,
  AxelarClient,
  EvmClient,
  DatabaseClient,
} from './clients';
import { axelarChain, cosmosChains, evmChains } from './config';
import {
  ContractCallSubmitted,
  ContractCallWithTokenSubmitted,
  EvmEvent,
  ExecuteRequest,
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
  handleEvmToCosmosEvent,
  handleCosmosToEvmCallContractCompleteEvent,
  prepareHandler,
  handleEvmToCosmosConfirmEvent,
  handleCosmosToEvmEvent,
} from './handler';
import { initServer } from './api';
import { logger } from './logger';
import { createCosmosEventSubject, createEvmEventSubject } from './subject';
import { filterCosmosDestination } from './utils/filterUtils';

const sEvmCallContract = createEvmEventSubject<ContractCallEventObject>();
const sEvmCallContractWithToken =
  createEvmEventSubject<ContractCallWithTokenEventObject>();

const sEvmConfirmEvent = new Subject<ExecuteRequest>();
const sEvmApproveContractCallWithToken =
  createEvmEventSubject<ContractCallApprovedWithMintEventObject>();
const sEvmApproveContractCall =
  createEvmEventSubject<ContractCallApprovedEventObject>();
const sCosmosContractCall = createCosmosEventSubject<ContractCallSubmitted>();
const sCosmosContractCallWithToken =
  createCosmosEventSubject<ContractCallWithTokenSubmitted>();

// Listening to the IBC packet event. This mean the any gmp flow (both contractCall and contractCallWithToken) from evm -> cosmos is completed.
const sCosmosApproveAny = new Subject<IBCPacketEvent>();

const db = new DatabaseClient();

async function main() {
  const listeners = evmChains.map((evm) => new GMPListenerClient(evm));
  const axelarClient = await AxelarClient.init(db, axelarChain);
  const evmClients = evmChains.map((evm) => new EvmClient(evm));
  //   const cosmosClients = cosmosChains.map((cosmos) => AxelarClient.init(cosmos));

  /** ######## Handle events ########## */

  // Subscribe to the ContractCallWithToken event at the gateway contract (EVM -> Cosmos direction)
  // Filter the event by the supported cosmos chains. This is to avoid conflict with existing relayers that relay to evm chains.
  sEvmCallContractWithToken
    .pipe(filterCosmosDestination(cosmosChains))
    .subscribe((event) => {
      const _event = event as EvmEvent<ContractCallWithTokenEventObject>;
      prepareHandler(_event, db, 'handleEvmToCosmosEvent')
        .then(() => db.createEvmCallContractWithTokenEvent(_event))
        .then(() => event.waitForFinality())
        .then(() => handleEvmToCosmosEvent(axelarClient, _event))
        .catch((e) => handleAnyError(db, 'handleEvmToCosmosEvent', e));
    });

  sEvmCallContract
    .pipe(filterCosmosDestination(cosmosChains))
    .subscribe((event) => {
      const _event = event as EvmEvent<ContractCallEventObject>;
      prepareHandler(event, db, 'handleEvmToCosmosEvent')
        .then(() => db.createEvmCallContractEvent(_event))
        .then(() => _event.waitForFinality())
        .then(() => handleEvmToCosmosEvent(axelarClient, _event))
        .catch((e) => handleAnyError(db, 'handleEvmToCosmosEvent', e));
    });

  sEvmConfirmEvent.subscribe((executeParams) => {
    prepareHandler(executeParams, db, 'handleEvmToCosmosConfirmEvent')
      .then(() => handleEvmToCosmosConfirmEvent(axelarClient, executeParams))
      .catch((e) => handleAnyError(db, 'handleEvmToCosmosConfirmEvent', e));
  });

  // Subscribe to the IBCComplete event at the axelar network. (EVM -> Cosmos direction)
  // This mean the gmp flow is completed.
  sCosmosApproveAny.subscribe((event) => {
    prepareHandler(event, db, 'handleEvmToCosmosCompleteEvent')
      .then(() => handleEvmToCosmosCompleteEvent(axelarClient, event))
      .catch((e) => handleAnyError(db, 'handleEvmToCosmosCompleteEvent', e));
  });

  // Subscribe to the ContractCall event at the axelar network. (Cosmos -> EVM direction)
  sCosmosContractCall.subscribe((event) => {
    prepareHandler(event, db, 'handleContractCallFromCosmosToEvmEvent')
      .then(() => db.createCosmosContractCallEvent(event))
      .then(() => handleCosmosToEvmEvent(axelarClient, evmClients, event))
      .then((tx) => db.updateCosmosToEvmEvent(event, tx))
      .catch((e) => handleAnyError(db, 'handleCosmosToEvmEvent', e));
  });

  // Subscribe to the ContractCallWithToken event at the axelar network. (Cosmos -> EVM direction)
  sCosmosContractCallWithToken.subscribe((event) => {
    prepareHandler(event, db, 'handleContractCallWithTokenFromCosmosToEvmEvent')
      .then(() => db.createCosmosContractCallWithTokenEvent(event))
      .then(() => handleCosmosToEvmEvent(axelarClient, evmClients, event))
      .then((tx) => db.updateCosmosToEvmEvent(event, tx))
      .catch((e) => handleAnyError(db, 'handleCosmosToEvmEvent', e));
  });

  // Subscribe to the ContractCallApprovedWithMint event at the gateway contract. (Cosmos -> EVM direction)
  sEvmApproveContractCallWithToken.subscribe((event) => {
    prepareHandler(
      event,
      db,
      'handleCosmosToEvmCallContractWithTokenCompleteEvent'
    )
      .then(() =>
        handleCosmosToEvmCallContractWithTokenCompleteEvent(evmClients, event)
      )
      .catch((e) =>
        handleAnyError(
          db,
          'handleCosmosToEvmCallContractWithTokenCompleteEvent',
          e
        )
      );
  });

  // Subscribe to the ContractCallApproved event at the gateway contract. (Cosmos -> EVM direction)
  sEvmApproveContractCall.subscribe((event) => {
    prepareHandler(event, db, 'handleCosmosToEvmCallContractCompleteEvent')
      //   .then(() => db.findCosmosToEvmCallContractApproved(event))
      .then(() =>
        handleCosmosToEvmCallContractCompleteEvent(
          evmClients,
          db.getPrismaClient(),
          event
        )
      )
      .catch((e) =>
        handleAnyError(db, 'handleCosmosToEvmCallContractCompleteEvent', e)
      );
  });

  // ########## Listens for events ##########

  for (const listener of listeners) {
    listener.listenForEvmGMP(
      sEvmCallContract,
      sEvmCallContractWithToken,
      sEvmApproveContractCallWithToken,
      sEvmApproveContractCall
    );
  }

  axelarClient.listenForCosmosGMP(
    sCosmosContractCall,
    sCosmosContractCallWithToken
  );
  axelarClient.listenForIBCComplete(sCosmosApproveAny);
  axelarClient.listenForEvmEventCompleted(sEvmConfirmEvent);
}

logger.info('Starting relayer server...');
initServer();

// handle error globally
main();
