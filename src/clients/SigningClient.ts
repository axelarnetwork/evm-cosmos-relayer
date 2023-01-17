import { CosmosNetworkConfig } from '../config/types';
import { config as appConfig, env } from '../config';
import { AxelarSigningClient, Environment } from '@axelar-network/axelarjs-sdk';
import { EncodeObject } from '@cosmjs/proto-signing';
import { StdFee } from '@cosmjs/stargate';
import { MsgTransfer } from '@axelar-network/axelarjs-types/ibc/applications/transfer/v1/tx';
import {
  AxelarQueryClient,
  AxelarQueryClientType,
} from '@axelar-network/axelarjs-sdk/dist/src/libs/AxelarQueryClient';
import { sleep } from '../utils/utils';
import { Registry } from '@cosmjs/proto-signing';
import { logger } from '../logger';

export class SigningClient {
  public config: CosmosNetworkConfig;
  public sdk: AxelarSigningClient;
  public queryClient: AxelarQueryClientType;
  public fee: StdFee;
  public maxRetries: number;
  public retryDelay: number;

  constructor(
    sdk: AxelarSigningClient,
    client: AxelarQueryClientType,
    config?: CosmosNetworkConfig,
    _maxRetries = env.MAX_RETRY,
    _retryDelay = env.RETRY_DELAY
  ) {
    this.config = config || appConfig.cosmos.devnet;
    this.sdk = sdk;
    this.queryClient = client;
    this.maxRetries = _maxRetries;
    this.retryDelay = _retryDelay;
    this.fee = {
      amount: [
        {
          denom: this.config.denom,
          amount: '1000',
        },
      ],
      gas: '10000000',
    };
  }

  static async init(_config?: CosmosNetworkConfig) {
    const config = _config || appConfig.cosmos.devnet;
    const _queryClient = await AxelarQueryClient.initOrGetAxelarQueryClient({
      environment: Environment.DEVNET,
      axelarRpcUrl: config.rpcUrl,
    });
    const registry = new Registry();
    registry.register('/ibc.applications.transfer.v1.MsgTransfer', MsgTransfer);
    const sdk = await AxelarSigningClient.initOrGetAxelarSigningClient({
      environment: Environment.DEVNET,
      axelarRpcUrl: config.rpcUrl,
      cosmosBasedWalletDetails: {
        mnemonic: config.mnemonic,
      },
      options: {
        registry,
      },
    });

    return new SigningClient(sdk, _queryClient, config);
  }

  public getAddress() {
    return this.sdk.signerAddress;
  }

  public async getBalance(address: string, denom?: string) {
    return this.sdk.getBalance(address, denom || 'uvx');
  }

  public broadcast<T extends EncodeObject[]>(
    payload: T,
    memo?: string,
    retries = 0
  ): Promise<any> {
    if (retries >= this.maxRetries) throw new Error('Max retries exceeded');
    return this.sdk
      .signThenBroadcast(payload, this.fee, memo)
      .catch(async (e: any) => {
        if (e.message.includes('account sequence mismatch')) {
          logger.info(
            `Account sequence mismatch, retrying in ${
              this.retryDelay / 1000
            } seconds...`
          );
          await sleep(this.retryDelay);
          return this.broadcast(payload, memo, retries + 1);
        }

        throw e;
      });
  }
}
