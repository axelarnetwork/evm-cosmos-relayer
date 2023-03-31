import {
  ContractCallSubmitted,
  ContractCallWithTokenSubmitted,
  ExecuteRequest,
  IBCEvent,
  IBCPacketEvent,
} from '../../types';
import { Parser } from './parser';
import { DatabaseClient } from '../..';

export interface AxelarEvent<T> {
  topicId: string;
  parseEvent: (event: any) => Promise<T>;
}

const parser = new Parser(new DatabaseClient());

export const AxelarEVMCompletedEvent: AxelarEvent<ExecuteRequest> = {
  topicId:
    "tm.event='NewBlock' AND axelar.evm.v1beta1.EVMEventCompleted.event_id EXISTS",
  parseEvent: parser.parseEvmEventCompletedEvent,
};

export const AxelarCosmosContractCallEvent: AxelarEvent<
  IBCEvent<ContractCallSubmitted>
> = {
  topicId: `tm.event='Tx' AND axelar.axelarnet.v1beta1.ContractCallSubmitted.message_id EXISTS`,
  parseEvent: parser.parseContractCallSubmittedEvent,
};

export const AxelarCosmosContractCallWithTokenEvent: AxelarEvent<
  IBCEvent<ContractCallWithTokenSubmitted>
> = {
  topicId: `tm.event='Tx' AND axelar.axelarnet.v1beta1.ContractCallWithTokenSubmitted.message_id EXISTS`,
  parseEvent: parser.parseContractCallWithTokenSubmittedEvent,
};

export const AxelarIBCCompleteEvent: AxelarEvent<IBCPacketEvent> = {
  topicId: `tm.event='Tx' AND message.action='ExecuteMessage'`,
  parseEvent: parser.parseIBCCompleteEvent,
};
