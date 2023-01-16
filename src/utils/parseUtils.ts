import { IBCGMPEvent } from '../types';
import { ContractCallWithTokenEventObject } from '../types/contracts/IAxelarGateway';
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

export const parseGMPEvent = (
  event: any
): IBCGMPEvent<ContractCallWithTokenEventObject> => {
  const key = 'axelar.axelarnet.v1beta1.GeneralMessageApprovedWithToken';
  const coin = JSON.parse(event[`${key}.coin`][0]);
  const data = {
    // sourceChain: removeQuote(event[`${key}.source_chain`][0]),
    sender: removeQuote(event[`${key}.sender`][0]),
    destinationChain: removeQuote(event[`${key}.destination_chain`][0]),
    payload: '0x' + decodeBase64(removeQuote(event[`${key}.payload`][0])),
    payloadHash:
      '0x' + decodeBase64(removeQuote(event[`${key}.payload_hash`][0])),
    symbol: coin.denom,
    amount: coin.amount,
    destinationContractAddress: removeQuote(
      event[`${key}.destination_address`][0]
    ),
  };

  return {
    hash: event['tx.hash'][0],
    srcChannel: event['write_acknowledgement.packet_src_channel'][0],
    destChannel: event['write_acknowledgement.packet_dst_channel'][0],
    args: data,
  };
};
