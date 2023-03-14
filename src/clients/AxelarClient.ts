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
import {
  ContractCallSubmitted,
  ContractCallWithTokenSubmitted,
  IBCEvent,
  IBCPacketEvent,
} from '../types';
import WebSocket from 'isomorphic-ws';
import { SigningClient } from '.';
import {
  parseContractCallSubmittedEvent,
  parseContractCallWithTokenSubmittedEvent,
} from '../utils/parseUtils';
import { ContractCallWithTokenEventObject } from '../types/contracts/IAxelarGateway';
import { logger } from '../logger';

export class AxelarClient {
  public signingClient: SigningClient;
  public ws: ReconnectingWebSocket | undefined;
  public callContractWs: ReconnectingWebSocket | undefined;
  public callContractWithTokenWs: ReconnectingWebSocket | undefined;
  private wsOptions = {
    WebSocket, // custom WebSocket constructor
    connectionTimeout: 30000,
    maxRetries: 10,
  };
  public chainId: string;

  constructor(_signingClient: SigningClient, id: string) {
    this.signingClient = _signingClient;
    this.chainId = id;
  }

  static async init(_config: CosmosNetworkConfig) {
    const signingClient = await SigningClient.init(_config);
    return new AxelarClient(signingClient, _config.chainId);
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
        `[AxelarClient.signCommands] Failed to broadcast signCommands ${JSON.stringify(
          e
        )}`
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

    return `0x${response.executeData}`;
  }

  public async executeGeneralMessageWithToken(
    logIndex: number,
    txHash: string,
    payload: string
  ) {
    const _payload = getExecuteGeneralMessageWithTokenPayload(
      this.signingClient.getAddress(),
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
    calltractCallSubject: Subject<IBCEvent<ContractCallSubmitted>>,
    contractCallWithTokenSubject: Subject<
      IBCEvent<ContractCallWithTokenSubmitted>
    >
  ) {
    this.listenForCosmosContractCall(calltractCallSubject);
    this.listenForCosmosContractCallWithToken(contractCallWithTokenSubject);
  }

  private listenForCosmosContractCallWithToken(
    callContractWithTokenSubject: Subject<
      IBCEvent<ContractCallWithTokenSubmitted>
    >
  ) {
    if (this.callContractWithTokenWs) {
      return this.callContractWithTokenWs.reconnect();
    }

    this.callContractWithTokenWs = new ReconnectingWebSocket(
      this.signingClient.config.ws,
      [],
      this.wsOptions
    );

    const topic = `tm.event='Tx' AND axelar.axelarnet.v1beta1.ContractCallWithTokenSubmitted.message_id EXISTS`;

    this.callContractWithTokenWs.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'subscribe',
        params: [topic],
      })
    );

    this.callContractWithTokenWs.addEventListener(
      'message',
      (ev: MessageEvent<any>) => {
        // convert buffer to json
        const event = JSON.parse(ev.data.toString());

        // check if the event topic is matched
        if (!event.result || event.result.query !== topic) return;

        // parse the event data
        try {
          const data = parseContractCallWithTokenSubmittedEvent(
            event.result.events
          );

          callContractWithTokenSubject.next(data);
        } catch (e) {
          logger.error(
            `[AxelarClient.listenForCosmosContractCallWithToken] Error parsing GMP event: ${e}`
          );
        }
      }
    );
  }

  private listenForCosmosContractCall(
    callContractSubject: Subject<IBCEvent<ContractCallSubmitted>>
  ) {
    if (this.callContractWs) {
      return this.callContractWs.reconnect();
    }

    this.callContractWs = new ReconnectingWebSocket(
      this.signingClient.config.ws,
      [],
      this.wsOptions
    );

    const topic = `tm.event='Tx' AND axelar.axelarnet.v1beta1.ContractCallSubmitted.message_id EXISTS`;

    this.callContractWs.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'subscribe',
        params: [topic],
      })
    );

    this.callContractWs.addEventListener('message', (ev: MessageEvent<any>) => {
      // convert buffer to json
      const event = JSON.parse(ev.data.toString());

      // check if the event topic is matched
      if (!event.result || event.result.query !== topic) return;

      // parse the event data
      try {
        const data = parseContractCallSubmittedEvent(event.result.events);

        callContractSubject.next(data);
      } catch (e) {
        logger.error(
          `[AxelarClient.listenForCosmosGMP] Error parsing GMP event: ${e}`
        );
      }
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
