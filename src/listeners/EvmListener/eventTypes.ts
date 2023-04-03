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
export interface EvmListenerEvent<
  EventObject,
  Event extends TypedEvent<any, EventObject>
> {
  getEventFilter: (gateway: IAxelarGateway) => TypedEventFilter<Event>;
  parseEvent: (
    currentChainName: string,
    provider: ethers.providers.Provider,
    event: Event,
    finalityBlocks: number
  ) => Promise<EvmEvent<EventObject>>;
}

export const EvmContractCallEvent: EvmListenerEvent<
  ContractCallEventObject,
  ContractCallEvent
> = {
  getEventFilter: (gateway: IAxelarGateway) =>
    gateway.filters['ContractCall(address,string,string,bytes32,bytes)'](),
  parseEvent: parseAnyEvent,
};

export const EvmContractCallWithTokenEvent: EvmListenerEvent<
  ContractCallWithTokenEventObject,
  ContractCallWithTokenEvent
> = {
  getEventFilter: (gateway: IAxelarGateway) =>
    gateway.filters[
      'ContractCallWithToken(address,string,string,bytes32,bytes,string,uint256)'
    ](),
  parseEvent: parseAnyEvent,
};

export const EvmContractCallApprovedEvent: EvmListenerEvent<
  ContractCallApprovedEventObject,
  ContractCallApprovedEvent
> = {
  getEventFilter: (gateway: IAxelarGateway) =>
    gateway.filters[
      'ContractCallApproved(bytes32,string,string,address,bytes32,bytes32,uint256)'
    ](),
  parseEvent: parseAnyEvent,
};

export const EvmContractCallWithTokenApprovedEvent: EvmListenerEvent<
  ContractCallApprovedWithMintEventObject,
  ContractCallApprovedWithMintEvent
> = {
  getEventFilter: (gateway: IAxelarGateway) =>
    gateway.filters[
      'ContractCallApprovedWithMint(bytes32,string,string,address,bytes32,string,uint256,bytes32,uint256)'
    ](),
  parseEvent: parseAnyEvent,
};
