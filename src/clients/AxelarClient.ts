import { CosmosNetworkConfig } from "../config/types";
import { config as appConfig } from "../config";
import { AxelarSigningClient, Environment } from "@axelar-network/axelarjs-sdk";
import { StdFee } from "@cosmjs/stargate";
import {
  getConfirmGatewayTxPayload,
  getExecuteGeneralMessageWithTokenPayload,
} from "../utils/payloadBuilder";

export class AxelarClient {
  public config: CosmosNetworkConfig;
  public sdk: AxelarSigningClient;
  public fee: StdFee;

  constructor(sdk: AxelarSigningClient, config?: CosmosNetworkConfig) {
    this.config = config || appConfig.cosmos.devnet;
    this.sdk = sdk;
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
    const sdk = await AxelarSigningClient.initOrGetAxelarSigningClient({
      environment: Environment.DEVNET,
      axelarRpcUrl: config.rpcUrl,
      cosmosBasedWalletDetails: {
        mnemonic: config.mnemonic,
      },
      options: {},
    });

    return new AxelarClient(sdk, config);
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

  public async getBalance(address: string, denom?: string) {
    // const balances = await this.sdk.getAllBalances(address);
    // console.log(balances);
    return this.sdk.getBalance(address, denom || "uvx");
  }
}
