import { filter } from 'rxjs';
import { TypedEvent } from '../types/contracts/common';
import { EvmEvent } from '../types';
import {
  ContractCallEventObject,
  ContractCallWithTokenEventObject,
} from '../types/contracts/IAxelarGateway';
import { CosmosNetworkConfig } from '../config/types';

export const filterEventArgs = (event: TypedEvent) => {
  return Object.entries(event.args).reduce((acc, [key, value]) => {
    if (!isNaN(Number(key))) return acc;
    acc[key] = value;
    return acc;
  }, {} as any);
};

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
