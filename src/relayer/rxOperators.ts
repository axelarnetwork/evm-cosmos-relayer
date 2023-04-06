import { filter, of, throwError } from 'rxjs';
import { TypedEvent } from '../types/contracts/common';
import { EvmEvent } from '../types';
import {
  ContractCallApprovedEventObject,
  ContractCallApprovedWithMintEventObject,
  ContractCallEventObject,
  ContractCallWithTokenEventObject,
} from '../types/contracts/IAxelarGateway';
import { CosmosNetworkConfig } from '../config/types';
import { EvmClient } from '../clients';

export function filterCosmosDestination(cosmosChains: CosmosNetworkConfig[]) {
  return filter(
    (
      event: EvmEvent<
        ContractCallWithTokenEventObject | ContractCallEventObject
      >
    ) =>
      cosmosChains
        .map((chain) => chain.chainId)
        .includes(event.args.destinationChain)
  );
}

export function mapEventToEvmClient(
  event: EvmEvent<
    ContractCallApprovedEventObject | ContractCallApprovedWithMintEventObject
  >,
  evmClients: EvmClient[]
) {
  // Find the evm client associated with event's destination chain
  const evmClient = evmClients.find(
    (client) =>
      client.chainId.toLowerCase() === event.destinationChain.toLowerCase()
  );

  // If no evm client found, return
  if (!evmClient)
    return throwError(
      () =>
        `No evm client found for event's destination chain ${event.destinationChain}`
    );

  return of({
    evmClient,
    event,
  });
}
