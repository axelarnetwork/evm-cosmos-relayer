import { StdFee } from '@cosmjs/stargate';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { CosmosNetworkConfig } from 'config';
import { DeliverTxResponse, isDeliverTxFailure, isDeliverTxSuccess } from '@cosmjs/stargate';
import {
  getConfirmGatewayTxPayload,
  getExecuteMessageRequest,
  getSignCommandPayload,
} from '../../utils/payloadBuilder';
import { sleep } from '../../clients/sleep';
import { sha256 } from 'ethers/lib/utils';
import { DatabaseClient } from 'clients';
import { logger } from '../../logger';
import { SignerClient } from './AxelarSignerClient';

export class AxelarClient {
  public signingClient: SignerClient;
  public ws: ReconnectingWebSocket | undefined;
  public chainId: string;

  constructor(_signingClient: SignerClient, _db: DatabaseClient, id: string) {
    this.signingClient = _signingClient;
    this.chainId = id;
  }

  static async init(db: DatabaseClient, _config: CosmosNetworkConfig) {
    const signingClient = await SignerClient.init(_config);
    return new AxelarClient(signingClient, db, _config.chainId);
  }

  public confirmEvmTx(chain: string, txHash: string) {
    const payload = getConfirmGatewayTxPayload(this.signingClient.getAddress(), chain, txHash);
    return this.signingClient.broadcast(payload).catch((e: any) => {
      logger.error(`[AxelarClient.confirmEvmTx] Failed to broadcast ${e.message}`);
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
    const payload = getSignCommandPayload(this.signingClient.getAddress(), chain);

    return this.signingClient.broadcast(payload).catch((e: any) => {
      logger.error(`[AxelarClient.signCommands] Failed to broadcast signCommands ${e.message}`);
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

  public async executeMessageRequest(logIndex: number, txHash: string, payload: string) {
    const _payload = getExecuteMessageRequest(
      this.signingClient.getAddress(),
      txHash,
      logIndex,
      payload
    );
    return this.signingClient.broadcast(_payload).catch((e: any) => {
      if (e.message.indexOf('already executed') > -1) {
        logger.error(
          `[AxelarClient.executeMessageRequest] Already executed ${txHash} - ${logIndex}`
        );
      }
      logger.error(`[AxelarClient.executeMessageRequest] Failed to broadcast ${e.message}`);
      return undefined
    });
  }

  public setFee(fee: StdFee) {
    this.signingClient.fee = fee;
  }

  public async calculateTokenIBCPath(destChannelId: string, denom: string, port = 'transfer') {
    return sha256(Buffer.from(`${port}/${destChannelId}/${denom}`, 'hex'));
  }

  public async getBalance(address: string, denom?: string) {
    return this.signingClient.getBalance(address, denom);
  }

  public isTxSuccess(tx: DeliverTxResponse) {
    return isDeliverTxSuccess(tx);
  }

  public isTxFailed(tx: DeliverTxResponse) {
    return isDeliverTxFailure(tx);
  }
}
