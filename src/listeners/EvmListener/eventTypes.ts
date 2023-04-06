import { ethers } from 'ethers';
import { EvmEvent } from '../../types';
import { IAxelarGateway } from '../../types/contracts';
import {
  ContractCallApprovedEvent,
  ContractCallApprovedEventObject,
  ContractCallApprovedWithMintEvent,
  ContractCallApprovedWithMintEventObject,
  ContractCallEvent,
  ContractCallEventObject,
  ContractCallWithTokenEvent,
  ContractCallWithTokenEventObject,
} from '../../types/contracts/IAxelarGateway';
import { parseAnyEvent } from './parser';
import { TypedEvent, TypedEventFilter } from '../../types/contracts/common';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface EvmListenerEvent<EventObject, Event extends TypedEvent<any, EventObject>> {
  name: string; // use for logging purpose
  getEventFilter: (gateway: IAxelarGateway) => TypedEventFilter<Event>;
  isAcceptedChain: (allowedChainIds: string[], event: EventObject) => boolean;
  parseEvent: (
    currentChainName: string,
    provider: ethers.providers.Provider,
    event: Event,
    finalityBlocks: number
  ) => Promise<EvmEvent<EventObject>>;
}

export const EvmContractCallEvent: EvmListenerEvent<ContractCallEventObject, ContractCallEvent> = {
  name: 'ContractCall',
  getEventFilter: (gateway: IAxelarGateway) =>
    gateway.filters['ContractCall(address,string,string,bytes32,bytes)'](),
  isAcceptedChain: (allowedDestChainIds, event) =>
    allowedDestChainIds.includes(event.destinationChain.toLowerCase()),
  parseEvent: parseAnyEvent,
};

export const EvmContractCallWithTokenEvent: EvmListenerEvent<
  ContractCallWithTokenEventObject,
  ContractCallWithTokenEvent
> = {
  name: 'ContractCallWithToken',
  getEventFilter: (gateway: IAxelarGateway) =>
    gateway.filters['ContractCallWithToken(address,string,string,bytes32,bytes,string,uint256)'](),
  isAcceptedChain: (allowedDestChainIds, event) =>
    allowedDestChainIds.includes(event.destinationChain.toLowerCase()),
  parseEvent: parseAnyEvent,
};

export const EvmContractCallApprovedEvent: EvmListenerEvent<
  ContractCallApprovedEventObject,
  ContractCallApprovedEvent
> = {
  name: 'ContractCallApproved',
  getEventFilter: (gateway: IAxelarGateway) =>
    gateway.filters[
      'ContractCallApproved(bytes32,string,string,address,bytes32,bytes32,uint256)'
    ](),
  isAcceptedChain: (allowedSrcChainIds, event) =>
    allowedSrcChainIds.includes(event.sourceChain.toLowerCase()),
  parseEvent: parseAnyEvent,
};

export const EvmContractCallWithTokenApprovedEvent: EvmListenerEvent<
  ContractCallApprovedWithMintEventObject,
  ContractCallApprovedWithMintEvent
> = {
  name: 'ContractCallWithTokenApproved',
  getEventFilter: (gateway: IAxelarGateway) =>
    gateway.filters[
      'ContractCallApprovedWithMint(bytes32,string,string,address,bytes32,string,uint256,bytes32,uint256)'
    ](),
  isAcceptedChain: (allowedSrcChainIds, event) =>
    allowedSrcChainIds.includes(event.sourceChain.toLowerCase()),
  parseEvent: parseAnyEvent,
};
