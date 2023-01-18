import { CosmosNetworkConfig } from '../config/types';
import { StdFee } from '@cosmjs/stargate';
import {
  getConfirmGatewayTxPayload,
  getExecuteGeneralMessageWithTokenPayload,
  getSignCommandPayload,
} from '../utils/payloadBuilder';
import { sleep } from '../utils/utils';
import { sha256 } from 'ethers/lib/utils';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { Subject } from 'rxjs';
import { IBCEvent, IBCPacketEvent } from '../types';
import WebSocket from 'isomorphic-ws';
import { SigningClient } from '.';
import { parseGMPEvent } from '../utils/parseUtils';
import { ContractCallWithTokenEventObject } from '../types/contracts/IAxelarGateway';
import { logger } from '../logger';

export class AxelarClient {
  public signingClient: SigningClient;
  public ws: ReconnectingWebSocket | undefined;
  public gmpWs: ReconnectingWebSocket | undefined;

  constructor(_signingClient: SigningClient) {
    this.signingClient = _signingClient;
  }

  static async init(_config?: CosmosNetworkConfig) {
    const signingClient = await SigningClient.init(_config);
    return new AxelarClient(signingClient);
  }

  public confirmEvmTx(chain: string, txHash: string) {
    const payload = getConfirmGatewayTxPayload(
      this.signingClient.getAddress(),
      chain,
      txHash
    );
    return this.signingClient.broadcast(payload).catch((e: any) => {
      logger.error(
        `[AxelarClient.confirmEvmTx] Failed to broadcast ${JSON.stringify(e)}`
      );
    });
  }

  public getPendingCommands(chain: string) {
    return this.signingClient.queryClient.evm
      .PendingCommands({
        chain,
      })
      .then((result) => result.commands);
  }

  public signCommands(chain: string) {
    const payload = getSignCommandPayload(
      this.signingClient.getAddress(),
      chain
    );
    return this.signingClient.broadcast(payload).catch((e: any) => {
      logger.error(
        `[AxelarClient.signCommands] Failed to broadcast ${JSON.stringify(e)}`
      );
    });
  }

  public async getExecuteDataFromBatchCommands(chain: string, id: string) {
    // wait until status: 3
    let response = await this.signingClient.queryClient.evm.BatchedCommands({
      chain,
      id,
    });

    while (response.status !== 3) {
      await sleep(3000);
      response = await this.signingClient.queryClient.evm.BatchedCommands({
        chain,
        id,
      });
    }

    return '0x' + response.executeData;
  }

  public async executeGeneralMessageWithToken(
    destChain: string,
    logIndex: number,
    txHash: string,
    payload: string
  ) {
    const _payload = getExecuteGeneralMessageWithTokenPayload(
      this.signingClient.getAddress(),
      destChain,
      txHash,
      logIndex,
      payload
    );
    return this.signingClient.broadcast(_payload).catch((e: any) => {
      logger.error(
        `[AxelarClient.executeGeneralMessageWithToken] Failed to broadcast ${JSON.stringify(
          e
        )}`
      );
    });
  }

  public setFee(fee: StdFee) {
    this.signingClient.fee = fee;
  }

  private getEvent(chain: string, eventId: string) {
    return this.signingClient.queryClient.evm.Event({
      chain,
      eventId,
    });
  }

  public async isContractCallWithTokenConfirmed(
    chain: string,
    eventId: string
  ) {
    const event = await this.getEvent(chain, eventId).catch(() => undefined);
    return !!event?.event?.contractCallWithToken;
  }

  public async pollUntilContractCallWithTokenConfirmed(
    chain: string,
    eventId: string,
    pollingInterval = 1000
  ) {
    let confirmed = false;
    while (!confirmed) {
      confirmed = await this.isContractCallWithTokenConfirmed(chain, eventId);
      await sleep(pollingInterval);
    }
  }

  public listenForCosmosGMP(
    subject: Subject<IBCEvent<ContractCallWithTokenEventObject>>
  ) {
    // Debugging Purpose: Logging balance update
    const options = {
      WebSocket, // custom WebSocket constructor
      connectionTimeout: 1000,
      maxRetries: 10,
    };

    if (this.gmpWs) {
      return this.gmpWs.reconnect();
    }

    this.gmpWs = new ReconnectingWebSocket(
      this.signingClient.config.ws,
      [],
      options
    );

    const topic = `tm.event='Tx' AND axelar.axelarnet.v1beta1.GeneralMessageApprovedWithToken.source_chain EXISTS`;

    this.gmpWs.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'subscribe',
        params: [topic],
      })
    );
    this.gmpWs.addEventListener('message', (ev: MessageEvent<any>) => {
      // convert buffer to json
      const event = JSON.parse(ev.data.toString());

      // check if the event topic is matched
      if (!event.result || event.result.query !== topic) return;

      // parse the event data
      const data = parseGMPEvent(event.result.events);

      subject.next(data);
    });
  }

  public listenForIBCComplete(subject: Subject<IBCPacketEvent>) {
    // Debugging Purpose: Logging balance update
    const options = {
      WebSocket, // custom WebSocket constructor
      connectionTimeout: 1000,
      maxRetries: 10,
    };

    if (this.ws) {
      return this.ws.reconnect();
    }

    this.ws = new ReconnectingWebSocket(
      this.signingClient.config.ws,
      [],
      options
    );

    const topic = `tm.event='Tx' AND acknowledge_packet.packet_dst_port='transfer'`;

    this.ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'subscribe',
        params: [topic],
      })
    );
    this.ws.addEventListener('message', (ev: MessageEvent<any>) => {
      // convert buffer to json
      const event = JSON.parse(ev.data.toString());

      // check if the event topic is matched
      if (event.result.query !== topic) return;

      // parse the event data
      const data = {
        sequence: parseInt(
          event.result.events['acknowledge_packet.packet_sequence'][0]
        ),
        amount: event.result.events['fungible_token_packet.amount'][0],
        denom: event.result.events['fungible_token_packet.denom'][0],
        destChannel:
          event.result.events['acknowledge_packet.packet_dst_channel'][0],
        srcChannel:
          event.result.events['acknowledge_packet.packet_src_channel'][0],
        hash: event.result.events['tx.hash'][0],
      };

      // emit the event
      subject.next(data);
    });
  }

  public async calculateTokenIBCPath(
    destChannelId: string,
    denom: string,
    port = 'transfer'
  ) {
    return sha256(Buffer.from(`${port}/${destChannelId}/${denom}`, 'hex'));
  }

  public async getBalance(address: string, denom?: string) {
    return this.signingClient.getBalance(address, denom);
  }
}
