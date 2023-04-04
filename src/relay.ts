import { Subject, mergeMap } from 'rxjs';
import { AxelarClient, EvmClient, DatabaseClient } from './clients';
import { axelarChain, cosmosChains, evmChains } from './config';
import {
  ContractCallSubmitted,
  ContractCallWithTokenSubmitted,
  EvmEvent,
  ExecuteRequest,
  IBCPacketEvent,
} from './types';
import {
  AxelarCosmosContractCallEvent,
  AxelarCosmosContractCallWithTokenEvent,
  AxelarEVMCompletedEvent,
  AxelarIBCCompleteEvent,
  EvmContractCallApprovedEvent,
  EvmContractCallEvent,
  EvmContractCallWithTokenApprovedEvent,
  EvmContractCallWithTokenEvent,
  EvmListener,
  AxelarListener,
} from './listeners';
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
import { filterCosmosDestination, mapEventToEvmClient } from './utils/operatorUtils';

const sEvmCallContract = createEvmEventSubject<ContractCallEventObject>();
const sEvmCallContractWithToken = createEvmEventSubject<ContractCallWithTokenEventObject>();
const sEvmApproveContractCallWithToken =
  createEvmEventSubject<ContractCallApprovedWithMintEventObject>();
const sEvmApproveContractCall = createEvmEventSubject<ContractCallApprovedEventObject>();
const sCosmosContractCall = createCosmosEventSubject<ContractCallSubmitted>();
const sCosmosContractCallWithToken = createCosmosEventSubject<ContractCallWithTokenSubmitted>();

// Listening to the IBC packet event. This mean the any gmp flow (both contractCall and contractCallWithToken) from evm -> cosmos is completed.
const sEvmConfirmEvent = new Subject<ExecuteRequest>();
const sCosmosApproveAny = new Subject<IBCPacketEvent>();

// Initialize DB client
const db = new DatabaseClient();

const cosmosChainNames = cosmosChains.map(chain => chain.chainId)

async function main() {
  const axelarListener = new AxelarListener(db, axelarChain.ws);
  const evmListeners = evmChains.map((evm) => new EvmListener(evm, cosmosChainNames));
  const axelarClient = await AxelarClient.init(db, axelarChain);
  const evmClients = evmChains.map((evm) => new EvmClient(evm));
  //   const cosmosClients = cosmosChains.map((cosmos) => AxelarClient.init(cosmos));

  /** ######## Handle events ########## */

  // Subscribe to the ContractCallWithToken event at the gateway contract (EVM -> Cosmos direction)
  sEvmCallContractWithToken
    // Filter the event by the supported cosmos chains. This is to avoid conflict with existing relayers that relay to evm chains.
    .pipe(filterCosmosDestination(cosmosChains))
    .subscribe((event) => {
      const ev = event as EvmEvent<ContractCallWithTokenEventObject>;
      prepareHandler(ev, db, 'handleEvmToCosmosEvent')
        // Create the event in the database
        .then(() => db.createEvmCallContractWithTokenEvent(ev))
        // Wait for the event to be finalized
        .then(() => event.waitForFinality())
        //  Handle the event by sending the confirm tx to the axelar network
        .then(() => handleEvmToCosmosEvent(axelarClient, ev))
        // catch any error
        .catch((e) => handleAnyError(db, 'handleEvmToCosmosEvent', e));
    });

  // Subscribe to the ContractCall event at the gateway contract (EVM -> Cosmos direction)
  sEvmCallContract
    // Filter the event by the supported cosmos chains. This is to avoid conflict with existing relayers that relay to evm chains.
    .pipe(filterCosmosDestination(cosmosChains))
    .subscribe((event) => {
      const ev = event as EvmEvent<ContractCallEventObject>;
      prepareHandler(event, db, 'handleEvmToCosmosEvent')
        // Create the event in the database
        .then(() => db.createEvmCallContractEvent(ev))
        // Wait for the event to be finalized
        .then(() => ev.waitForFinality())
        // Handle the event by sending the confirm tx to the axelar network
        .then(() => handleEvmToCosmosEvent(axelarClient, ev))
        // catch any error
        .catch((e) => handleAnyError(db, 'handleEvmToCosmosEvent', e));
    });

  // Subscribe to the ContractCallWithToken event at the gateway contract (EVM -> Cosmos direction)
  sEvmConfirmEvent.subscribe((executeParams) => {
    prepareHandler(executeParams, db, 'handleEvmToCosmosConfirmEvent')
      // Send the execute tx to the axelar network
      .then(() => handleEvmToCosmosConfirmEvent(axelarClient, executeParams))
      // Update the event status in the database
      .then(({ status, packetSequence }) =>
        db.updateEventStatusWithPacketSequence(executeParams.id, status, packetSequence)
      )
      // catch any error
      .catch((e) => handleAnyError(db, 'handleEvmToCosmosConfirmEvent', e));
  });

  // Subscribe to the IBCComplete event at the axelar network. (EVM -> Cosmos direction)
  // This mean the gmp flow is completed.
  sCosmosApproveAny.subscribe((event) => {
    prepareHandler(event, db, 'handleEvmToCosmosCompleteEvent')
      // Just logging the event for now
      .then(() => handleEvmToCosmosCompleteEvent(axelarClient, event))
      // catch any error
      .catch((e) => handleAnyError(db, 'handleEvmToCosmosCompleteEvent', e));
  });

  // Subscribe to the ContractCall event at the axelar network. (Cosmos -> EVM direction)
  sCosmosContractCall.subscribe((event) => {
    prepareHandler(event, db, 'handleContractCallFromCosmosToEvmEvent')
      // Create the event in the database
      .then(() => db.createCosmosContractCallEvent(event))
      // Handle the event by sending a bunch of txs to axelar network
      .then(() => handleCosmosToEvmEvent(axelarClient, evmClients, event))
      // Update the event status in the database
      .then((tx) => db.updateCosmosToEvmEvent(event, tx))
      // catch any error
      .catch((e) => handleAnyError(db, 'handleCosmosToEvmEvent', e));
  });

  // Subscribe to the ContractCallWithToken event at the axelar network. (Cosmos -> EVM direction)
  sCosmosContractCallWithToken.subscribe((event) => {
    prepareHandler(event, db, 'handleContractCallWithTokenFromCosmosToEvmEvent')
      // Create the event in the database
      .then(() => db.createCosmosContractCallWithTokenEvent(event))
      // Handle the event by sending a bunch of txs to axelar network
      .then(() => handleCosmosToEvmEvent(axelarClient, evmClients, event))
      // Update the event status in the database
      .then((tx) => db.updateCosmosToEvmEvent(event, tx))
      // catch any error
      .catch((e) => handleAnyError(db, 'handleCosmosToEvmEvent', e));
  });

  // Subscribe to the ContractCallApprovedWithMint event at the gateway contract. (Cosmos -> EVM direction)
  sEvmApproveContractCallWithToken
    // Select the evm client that matches the event's chain
    .pipe(mergeMap((event) => mapEventToEvmClient(event, evmClients)))
    .subscribe(({ evmClient, event }) => {
      const ev = event as EvmEvent<ContractCallApprovedWithMintEventObject>;
      prepareHandler(event, db, 'handleCosmosToEvmCallContractWithTokenCompleteEvent')
        // Find the array of relay data associated with the event from the database
        .then(() => db.findCosmosToEvmCallContractWithTokenApproved(ev))
        // Handle the event by calling executeWithToken function at the destination contract.
        .then((relayDatas) =>
          handleCosmosToEvmCallContractWithTokenCompleteEvent(evmClient, ev, relayDatas)
        )
        // Update the event status in the database
        .then((results) =>
          results?.forEach((result) => db.updateEventStatus(result.id, result.status))
        )
        // catch any error
        .catch((e) => handleAnyError(db, 'handleCosmosToEvmCallContractWithTokenCompleteEvent', e));
    });

  // Subscribe to the ContractCallApproved event at the gateway contract. (Cosmos -> EVM direction)
  sEvmApproveContractCall
    // Select the evm client that matches the event's chain
    .pipe(mergeMap((event) => mapEventToEvmClient(event, evmClients)))
    .subscribe(({ event, evmClient }) => {
      prepareHandler(event, db, 'handleCosmosToEvmCallContractCompleteEvent')
        // Find the array of relay data associated with the event from the database
        .then(() => db.findCosmosToEvmCallContractApproved(event))
        // Handle the event by calling execute function at the destination contract.
        .then((relayDatas) =>
          handleCosmosToEvmCallContractCompleteEvent(evmClient, event, relayDatas)
        )
        // Update the event status in the database
        .then((results) =>
          results?.forEach((result) => db.updateEventStatus(result.id, result.status))
        )
        .catch((e) => handleAnyError(db, 'handleCosmosToEvmCallContractCompleteEvent', e));
    });

  // ########## Listens for events ##########

  for (const evmListener of evmListeners) {
    evmListener.listen(EvmContractCallEvent, sEvmCallContract);
    evmListener.listen(EvmContractCallWithTokenEvent, sEvmCallContractWithToken);
    evmListener.listen(EvmContractCallApprovedEvent, sEvmApproveContractCall);
    evmListener.listen(EvmContractCallWithTokenApprovedEvent, sEvmApproveContractCallWithToken);
  }

  axelarListener.listen(AxelarCosmosContractCallEvent, sCosmosContractCall);
  axelarListener.listen(AxelarCosmosContractCallWithTokenEvent, sCosmosContractCallWithToken);
  axelarListener.listen(AxelarIBCCompleteEvent, sCosmosApproveAny);
  axelarListener.listen(AxelarEVMCompletedEvent, sEvmConfirmEvent);
}

logger.info('Starting relayer server...');
initServer();

// handle error globally
main();
