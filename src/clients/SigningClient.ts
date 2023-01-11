import { CosmosNetworkConfig } from "../config/types";
import { config as appConfig } from "../config";
import { AxelarSigningClient, Environment } from "@axelar-network/axelarjs-sdk";
import { EncodeObject } from "@cosmjs/proto-signing";
import { StdFee } from "@cosmjs/stargate";
import { MsgTransfer, protobufPackage } from "@axelar-network/axelarjs-types/ibc/applications/transfer/v1/tx";
import {
  AxelarQueryClient,
  AxelarQueryClientType,
} from "@axelar-network/axelarjs-sdk/dist/src/libs/AxelarQueryClient";
import { sleep } from "../utils/utils";
import {
  Registry,
} from "@cosmjs/proto-signing";

export class SigningClient {
  public config: CosmosNetworkConfig;
  public sdk: AxelarSigningClient;
  public queryClient: AxelarQueryClientType;
  public fee: StdFee;

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
    const registry = new Registry();
    registry.register("/ibc.applications.transfer.v1.MsgTransfer", MsgTransfer)
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
    return this.sdk.getBalance(address, denom || "uvx");
  }

  public broadcast<T extends EncodeObject[]>(payload: T, memo?: string): Promise<any> {
    return this.sdk.signThenBroadcast(payload, this.fee, memo).catch(async (e: any) => {
      if(e.message.includes('account sequence mismatch')) {
        console.log("Account sequence mismatch, retrying in 3 seconds...")
        await sleep(3000);
        return this.broadcast(payload);
      }

      throw e;
    })
  }
}
