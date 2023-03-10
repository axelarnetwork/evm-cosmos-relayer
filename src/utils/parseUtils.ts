import { ContractCallWithTokenSubmitted, IBCEvent } from '../types';
import {
  ContractCallEventObject,
  ContractCallWithTokenEventObject,
} from '../types/contracts/IAxelarGateway';
import { ContractCallSubmitted } from '../types';
import { decodeBase64, removeQuote } from './utils';

export const getPacketSequenceFromExecuteTx = (executeTx: any) => {
  const rawLog = JSON.parse(executeTx.rawLog || '{}');
  const events = rawLog[0].events;
  const sendPacketEvent = events.find(
    (event: { type: string }) => event.type === 'send_packet'
  );
  const seq = sendPacketEvent.attributes.find(
    (attr: { key: string }) => attr.key === 'packet_sequence'
  ).value;
  return parseInt(seq);
};

export const getBatchCommandIdFromSignTx = (signTx: any) => {
  const rawLog = JSON.parse(signTx.rawLog || '{}');
  const events = rawLog[0].events;
  const signEvent = events.find(
    (event: { type: string }) => event.type === 'sign'
  );
  const batchedCommandId = signEvent.attributes.find(
    (attr: { key: string }) => attr.key === 'batchedCommandID'
  ).value;
  return batchedCommandId;
};

export const parseContractCallSubmittedEvent = (
  event: any
): IBCEvent<ContractCallSubmitted> => {
  const key = 'axelar.axelarnet.v1beta1.ContractCallSubmitted';
  const data = {
    messageId: removeQuote(event[`${key}.message_id`][0]),
    sender: removeQuote(event[`${key}.sender`][0]),
    sourceChain: removeQuote(event[`${key}.source_chain`][0]),
    destinationChain: removeQuote(event[`${key}.destination_chain`][0]),
    contractAddress: removeQuote(event[`${key}.contract_address`][0]),
    payload: `0x${decodeBase64(removeQuote(event[`${key}.payload`][0]))}`,
    payloadHash: `0x${decodeBase64(
      removeQuote(event[`${key}.payload_hash`][0])
    )}`,
  };

  return {
    hash: event['tx.hash'][0],
    srcChannel: event['write_acknowledgement.packet_src_channel'][0],
    destChannel: event['write_acknowledgement.packet_dst_channel'][0],
    args: data,
  };
};

export const parseContractCallWithTokenSubmittedEvent = (
  event: any
): IBCEvent<ContractCallWithTokenSubmitted> => {
  const key = 'axelar.axelarnet.v1beta1.ContractCallSubmitted';
  const data = {
    messageId: removeQuote(event[`${key}.message_id`][0]),
    sender: removeQuote(event[`${key}.sender`][0]),
    sourceChain: removeQuote(event[`${key}.source_chain`][0]),
    destinationChain: removeQuote(event[`${key}.destination_chain`][0]),
    contractAddress: removeQuote(event[`${key}.contract_address`][0]),
    amount: '0', // coin.amount and coin.denom?
    symbol: 'aUSDC',
    payload: `0x${decodeBase64(removeQuote(event[`${key}.payload`][0]))}`,
    payloadHash: `0x${decodeBase64(
      removeQuote(event[`${key}.payload_hash`][0])
    )}`,
  };

  return {
    hash: event['tx.hash'][0],
    srcChannel: event['write_acknowledgement.packet_src_channel'][0],
    destChannel: event['write_acknowledgement.packet_dst_channel'][0],
    args: data,
  };
};
