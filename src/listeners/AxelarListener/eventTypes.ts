import { DatabaseClient } from '../../clients';
import {
  ContractCallSubmitted,
  ContractCallWithTokenSubmitted,
  ExecuteRequest,
  IBCEvent,
  IBCPacketEvent,
} from '../../types';
import { Parser } from './parser';

export interface AxelarListenerEvent<T> {
  type: string;
  topicId: string;
  parseEvent: (event: any) => Promise<T>;
}

const parser = new Parser(new DatabaseClient());

export const AxelarEVMCompletedEvent: AxelarListenerEvent<ExecuteRequest> = {
  type: 'axelar.evm.v1beta1.EVMEventCompleted',
  topicId:
    "tm.event='NewBlock' AND axelar.evm.v1beta1.EVMEventCompleted.event_id EXISTS",
  parseEvent: parser.parseEvmEventCompletedEvent,
};

export const AxelarCosmosContractCallEvent: AxelarListenerEvent<
  IBCEvent<ContractCallSubmitted>
> = {
  type: 'axelar.axelarnet.v1beta1.ContractCallSubmitted',
  topicId: `tm.event='Tx' AND axelar.axelarnet.v1beta1.ContractCallSubmitted.message_id EXISTS`,
  parseEvent: parser.parseContractCallSubmittedEvent,
};

export const AxelarCosmosContractCallWithTokenEvent: AxelarListenerEvent<
  IBCEvent<ContractCallWithTokenSubmitted>
> = {
  type: 'axelar.axelarnet.v1beta1.ContractCallWithTokenSubmitted',
  topicId: `tm.event='Tx' AND axelar.axelarnet.v1beta1.ContractCallWithTokenSubmitted.message_id EXISTS`,
  parseEvent: parser.parseContractCallWithTokenSubmittedEvent,
};

export const AxelarIBCCompleteEvent: AxelarListenerEvent<IBCPacketEvent> = {
  type: 'ExecuteMessage',
  topicId: `tm.event='Tx' AND message.action='ExecuteMessage'`,
  parseEvent: parser.parseIBCCompleteEvent,
};
