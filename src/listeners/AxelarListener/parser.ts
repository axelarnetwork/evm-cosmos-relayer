import { DatabaseClient } from '../..';
import { logger } from '../../logger';
import {
  ContractCallSubmitted,
  ContractCallWithTokenSubmitted,
  ExecuteRequest,
  IBCEvent,
  IBCPacketEvent,
} from '../../types';
import { decodeBase64, removeQuote } from '../../utils/utils';

export class Parser {
  private db: DatabaseClient;
  constructor(db: DatabaseClient) {
    this.db = db;
  }

  parseEvmEventCompletedEvent = async (event: any): Promise<ExecuteRequest> => {
    const eventId = removeQuote(event['axelar.evm.v1beta1.EVMEventCompleted.event_id'][0]);
    const errorMsg = `Not found eventId: ${eventId} in DB. Skip to handle an event.`;

    const payload = await this.db.findRelayDataById(eventId).then((data) => {
        return data?.callContract?.payload || data?.callContractWithToken?.payload;
    });

    if (!payload) throw new Error(errorMsg);

    return {
      id: eventId,
      payload,
    };
  };

  parseContractCallSubmittedEvent = (event: any): Promise<IBCEvent<ContractCallSubmitted>> => {
    const key = 'axelar.axelarnet.v1beta1.ContractCallSubmitted';
    const data = {
      messageId: removeQuote(event[`${key}.message_id`][0]),
      sender: removeQuote(event[`${key}.sender`][0]),
      sourceChain: removeQuote(event[`${key}.source_chain`][0]),
      destinationChain: removeQuote(event[`${key}.destination_chain`][0]),
      contractAddress: removeQuote(event[`${key}.contract_address`][0]),
      payload: `0x${decodeBase64(removeQuote(event[`${key}.payload`][0]))}`,
      payloadHash: `0x${decodeBase64(removeQuote(event[`${key}.payload_hash`][0]))}`,
    };

    return Promise.resolve({
      hash: event['tx.hash'][0],
      srcChannel: event['write_acknowledgement.packet_src_channel'][0],
      destChannel: event['write_acknowledgement.packet_dst_channel'][0],
      args: data,
    });
  };

  parseContractCallWithTokenSubmittedEvent(
    event: any
  ): Promise<IBCEvent<ContractCallWithTokenSubmitted>> {
    const key = 'axelar.axelarnet.v1beta1.ContractCallWithTokenSubmitted';
    const asset = JSON.parse(event[`${key}.asset`][0]);
    const data = {
      messageId: removeQuote(event[`${key}.message_id`][0]),
      sender: removeQuote(event[`${key}.sender`][0]),
      sourceChain: removeQuote(event[`${key}.source_chain`][0]),
      destinationChain: removeQuote(event[`${key}.destination_chain`][0]),
      contractAddress: removeQuote(event[`${key}.contract_address`][0]),
      amount: asset.amount.toString(),
      symbol: asset.denom,
      payload: `0x${decodeBase64(removeQuote(event[`${key}.payload`][0]))}`,
      payloadHash: `0x${decodeBase64(removeQuote(event[`${key}.payload_hash`][0]))}`,
    };

    return Promise.resolve({
      hash: event['tx.hash'][0],
      srcChannel: event['write_acknowledgement.packet_src_channel'][0],
      destChannel: event['write_acknowledgement.packet_dst_channel'][0],
      args: data,
    });
  }

  parseIBCCompleteEvent(event: any): Promise<IBCPacketEvent> {
    const packetData = event.result.events['send_packet.packet_data']?.[0];
    if (!packetData) return Promise.reject('packet_data not found');
    const memo = JSON.parse(packetData).memo;

    // parse the event data
    const data = {
      sequence: parseInt(event.result.events['send_packet.packet_sequence'][0]),
      amount: packetData.amount,
      denom: packetData.denom,
      destChannel: event.result.events['send_packet.packet_dst_channel'][0],
      srcChannel: event.result.events['send_packet.packet_src_channel'][0],
      hash: event.result.events['tx.hash'][0],
      memo,
    };

    return Promise.resolve(data);
  }
}
