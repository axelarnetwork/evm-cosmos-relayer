import { CosmosNetworkConfig } from "../config/types";
import { config as appConfig } from "../config";
import { AxelarSigningClient, Environment } from "@axelar-network/axelarjs-sdk";
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

export class AxelarClient {
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
    return this.sdk.signThenBroadcast(payload, this.fee);
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
    return this.sdk.signThenBroadcast(_payload, this.fee);
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
    // wait a bit more time
    // console.log("wait another 20s");
    // await sleep(20000);
    // console.log("done waiting");
  }

  public async calculateTokenIBCPath(destChannelId: string, denom: string, port = "transfer") {
   return sha256(Buffer.from(`${port}/${destChannelId}/${denom}`, "hex"));
  }

  public async getBalance(address: string, denom?: string) {
    return this.sdk.getBalance(address, denom || "uvx");
  }
}
