import { CosmosNetworkConfig } from "../config/types";
import { StdFee } from "@cosmjs/stargate";
import {
  getConfirmGatewayTxPayload,
  getExecuteGeneralMessageWithTokenPayload,
  getSignCommandPayload,
} from "../utils/payloadBuilder";
import { sleep } from "../utils/utils";
import { sha256 } from "ethers/lib/utils";
import ReconnectingWebSocket from "reconnecting-websocket";
import { Subject } from "rxjs";
import { IBCPacketEvent } from "../types";
import WebSocket from 'isomorphic-ws';
import {SignCommandsRequest} from '@axelar-network/axelarjs-types/axelar/evm/v1beta1/tx'
import { SigningClient } from ".";

export class AxelarClient {
  public signingClient: SigningClient;
  public ws: ReconnectingWebSocket | undefined;

  constructor(
    _signingClient: SigningClient,
  ) {
    this.signingClient = _signingClient
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
    return this.signingClient.broadcast(payload);
  }

  public getPendingCommands(chain: string) {
    return this.signingClient.queryClient.evm.PendingCommands({
      chain,
    });
  }

  public signCommands(chain: string) {
    const payload = getSignCommandPayload(chain)
    return this.signingClient.broadcast(payload)
  }

  public getBatchCommands(chain: string, id: string) {
    return this.signingClient.queryClient.evm.BatchedCommands({
      chain,
      id
    });
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
    return this.signingClient.broadcast(_payload);
  }

  public setFee(fee: StdFee) {
    this.signingClient.fee = fee
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

  public async pollEvent(chain: string,
    eventId: string,
    pollingInterval = 1000) {
      let attempt = 0;

    while(attempt < 3){
      const event = await this.getEvent(chain, eventId).catch(() => undefined);
      console.log(event)
      await sleep(pollingInterval);
      attempt++;
    }
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

  public listenForIBCComplete(subject: Subject<IBCPacketEvent>) {
    // Debugging Purpose: Logging balance update
    const options = {
      WebSocket, // custom WebSocket constructor
      connectionTimeout: 1000,
      maxRetries: 10,
    };

    if(this.ws) {
      return this.ws.reconnect();
    }

    this.ws = new ReconnectingWebSocket(this.signingClient.config.ws, [], options);

    const topic = `tm.event='Tx' AND acknowledge_packet.packet_dst_port='transfer'`

    this.ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'subscribe',
      params: [topic]
    }))
    this.ws.addEventListener('message', (ev: MessageEvent<any>) => {
      // convert buffer to json
      const event = JSON.parse(ev.data.toString())

      // check if the event topic is matched
      if(event.result.query !== topic) return;

      // parse the event data
      const sequence = parseInt(event.result.events['acknowledge_packet.packet_sequence'][0])
      const amount = event.result.events['fungible_token_packet.amount'][0]
      const denom = event.result.events['fungible_token_packet.denom'][0]
      const destChannel = event.result.events['acknowledge_packet.packet_dst_channel'][0]
      const srcChannel = event.result.events['acknowledge_packet.packet_src_channel'][0]
      const hash = event.result.events['tx.hash'][0]

      // emit the event
      subject.next({
        sequence,
        amount,
        denom,
        destChannel,
        hash,
        srcChannel
      })
    })
  }

  public async calculateTokenIBCPath(destChannelId: string, denom: string, port = "transfer") {
   return sha256(Buffer.from(`${port}/${destChannelId}/${denom}`, "hex"));
  }

  public async getBalance(address: string, denom?: string) {
    return this.signingClient.getBalance(address, denom)
  }
}
