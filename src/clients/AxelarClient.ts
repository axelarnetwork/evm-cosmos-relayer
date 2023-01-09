import { CosmosNetworkConfig } from "../config/types";
import { config as appConfig } from "../config";
import { AxelarSigningClient, Environment } from "@axelar-network/axelarjs-sdk";
import { EncodeObject } from "@cosmjs/proto-signing";
import { StdFee } from "@cosmjs/stargate";
import {
  getConfirmGatewayTxPayload,
  getExecuteGeneralMessageWithTokenPayload,
} from "../utils/payloadBuilder";
import {
  AxelarQueryClient,
  AxelarQueryClientType,
} from "@axelar-network/axelarjs-sdk/dist/src/libs/AxelarQueryClient";
import { sleep } from "../utils/utils";
import { sha256 } from "ethers/lib/utils";
import ReconnectingWebSocket from "reconnecting-websocket";
import { Subject } from "rxjs";
import { IBCPacketEvent } from "../types";
import WebSocket from 'isomorphic-ws';

export class AxelarClient {
  public config: CosmosNetworkConfig;
  public sdk: AxelarSigningClient;
  public queryClient: AxelarQueryClientType;
  public fee: StdFee;
  public ws: ReconnectingWebSocket | undefined;

  constructor(
    sdk: AxelarSigningClient,
    client: AxelarQueryClientType,
    config?: CosmosNetworkConfig
  ) {
    this.config = config || appConfig.cosmos.devnet;
    this.sdk = sdk;
    this.queryClient = client;
    this.fee = {
      amount: [
        {
          denom: this.config.denom,
          amount: "1000",
        },
      ],
      gas: "500000",
    };
  }

  static async init(_config?: CosmosNetworkConfig) {
    const config = _config || appConfig.cosmos.devnet;
    const _queryClient = await AxelarQueryClient.initOrGetAxelarQueryClient({
      environment: Environment.DEVNET,
      axelarRpcUrl: config.rpcUrl,
    });
    const sdk = await AxelarSigningClient.initOrGetAxelarSigningClient({
      environment: Environment.DEVNET,
      axelarRpcUrl: config.rpcUrl,
      cosmosBasedWalletDetails: {
        mnemonic: config.mnemonic,
      },
      options: {},
    });

    return new AxelarClient(sdk, _queryClient, config);
  }

  public confirmEvmTx(chain: string, txHash: string) {
    const payload = getConfirmGatewayTxPayload(
      this.sdk.signerAddress,
      chain,
      txHash
    );
    return this.broadcast(payload);
  }

  public async executeGeneralMessageWithToken(
    destChain: string,
    logIndex: number,
    txHash: string,
    payload: string
  ) {
    const _payload = getExecuteGeneralMessageWithTokenPayload(
      this.sdk.signerAddress,
      destChain,
      txHash,
      logIndex,
      payload
    );
    return this.broadcast(_payload);
  }

  private broadcast<T extends EncodeObject[]>(payload: T): Promise<any> {
    return this.sdk.signThenBroadcast(payload, this.fee).catch(async (e: any) => {
      if(e.message.includes('account sequence mismatch')) {
        console.log("Account sequence mismatch, retrying in 3 seconds...")
        await sleep(3000);
        return this.broadcast(payload);
      }

      throw e;
    })
  }

  public setFee(fee: StdFee) {
    this.fee = fee;
  }

  private getEvent(chain: string, eventId: string) {
    this.queryClient
    return this.queryClient.evm.Event({
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

    this.ws = new ReconnectingWebSocket(this.config.ws, [], options);

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
    return this.sdk.getBalance(address, denom || "uvx");
  }
}
