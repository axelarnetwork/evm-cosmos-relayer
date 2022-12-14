
// fetch the balance from given account
// the following is a path from the evm chain to cosmos chain
// confirm the transaction from evm

import { CosmosNetworkConfig } from "../config/types";
import { config as appConfig } from "../config";
import { EncodeObject } from "@cosmjs/proto-signing";
import {
  ConfirmDepositRequest as AxelarnetConfirmDepositRequest,
  ExecutePendingTransfersRequest as AxelarnetExecutePendingTransfersRequest,
  protobufPackage as AxelarnetProtobufPackage,
} from "@axelar-network/axelarjs-types/axelar/axelarnet/v1beta1/tx";
import {
  ConfirmDepositRequest as EvmConfirmDepositRequest,
  ConfirmGatewayTxRequest as EvmConfirmGatewayTxRequest,
  protobufPackage as EvmProtobufPackage,
} from "@axelar-network/axelarjs-types/axelar/evm/v1beta1/tx";
import { toAccAddress } from "@cosmjs/stargate/build/queryclient/utils";
import { AxelarSigningClient, Environment } from "@axelar-network/axelarjs-sdk";
import { utils } from "ethers";
import { StdFee } from "@cosmjs/stargate";

// execute msg to demo chain
export class AxelarClient {
  public config: CosmosNetworkConfig;
  public sdk: AxelarSigningClient;

  constructor(sdk: AxelarSigningClient, config?: CosmosNetworkConfig){
    this.config = config || appConfig.devnet;
    this.sdk = sdk;
  }

  static async init(_config?: CosmosNetworkConfig) {
    const config = _config || appConfig.devnet;
    const sdk = await AxelarSigningClient.initOrGetAxelarSigningClient({
      environment: Environment.DEVNET,
      axelarRpcUrl: config.rpcUrl,
      cosmosBasedWalletDetails: {
        mnemonic: config.mnemonic,
      },
      options: {},
    })

    return new AxelarClient(sdk, config)
  }

  public confirm = async(sender: string, burner: string, chain: string, txHash: string) => {
    const payload: EncodeObject[] = [
      {
        typeUrl: `/${EvmProtobufPackage}.ConfirmGatewayTxRequest`,
        value: EvmConfirmGatewayTxRequest.fromPartial({
          sender: toAccAddress(sender),
          chain,
          txId: utils.arrayify(txHash),
        }),
      },
    ];

    const fee: StdFee = {
      amount: [
        {
          denom: "uvx",
          amount: "1000",
        },
      ],
      gas: "5000000",
    };

    return this.sdk.signThenBroadcast(payload, fee)
  }

  public getBalance = async(address: string) => {
    return this.sdk.getBalance(address, "uvx")
  }
}
