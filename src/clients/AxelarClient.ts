import { CosmosNetworkConfig } from "../config/types";
import { config as appConfig } from "../config";
import { AxelarSigningClient, Environment } from "@axelar-network/axelarjs-sdk";
import { StdFee } from "@cosmjs/stargate";
import {
  getConfirmGatewayTxPayload,
  getExecuteGeneralMessageWithTokenPayload,
} from "../utils/payloadBuilder";
import { getProvider } from "../utils/providerUtils";

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
      gas: "5000000",
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

  public confirmEvmTx(sender: string, chain: string, txHash: string) {
    const payload = getConfirmGatewayTxPayload(sender, chain, txHash);
    return this.sdk.signThenBroadcast(payload, this.fee);
  }

  public async executeGeneralMessageWithToken(
    sender: string,
    srcChain: string,
    destChain: string,
    txHash: string,
    payload: string
  ) {
    const provider = getProvider(srcChain);
    const receipt = await provider?.getTransactionReceipt(txHash);
    receipt?.logs?.forEach((log) => {
    }
    const _payload = getExecuteGeneralMessageWithTokenPayload(
      sender,
      chain,
      txHash,
      payload
    );
    return this.sdk.signThenBroadcast(_payload, this.fee);
  }

  public setFee(fee: StdFee) {
    this.fee = fee;
  }

  public async getBalance(address: string) {
    return this.sdk.getBalance(address, "uvx");
  }
}
