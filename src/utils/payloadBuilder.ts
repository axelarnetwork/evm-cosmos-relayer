import {
  ConfirmGatewayTxRequest as EvmConfirmGatewayTxRequest,
  protobufPackage as EvmProtobufPackage,
} from "@axelar-network/axelarjs-types/axelar/evm/v1beta1/tx";
// import {} from "@axelar-network/axelarjs-types/axelar/evm/v1beta1/event";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { Height } from "cosmjs-types/ibc/core/client/v1/client";
import {
  ExecuteGeneralMessageWithTokenRequest,
  protobufPackage as AxelarProtobufPackage,
} from "@axelar-network/axelarjs-types/axelar/axelarnet/v1beta1/tx";
import { toAccAddress } from "@cosmjs/stargate/build/queryclient/utils";
import { fromHex } from "@cosmjs/encoding";
import { utils } from "ethers";
import { Coin, SigningStargateClient } from "@cosmjs/stargate";
import Long from "long";

/**
 * Get payload for confirm gateway tx on evm chain
 * @param sender - sender address
 * @param chain - chain name
 * @param txHash - source tx hash
 * @returns
 */
export function getConfirmGatewayTxPayload(
  sender: string,
  chain: string,
  txHash: string
) {
  return [
    {
      typeUrl: `/${EvmProtobufPackage}.ConfirmGatewayTxRequest`,
      value: EvmConfirmGatewayTxRequest.fromPartial({
        sender: toAccAddress(sender),
        chain,
        txId: utils.arrayify(txHash),
      }),
    },
  ];
}

export function getExecuteGeneralMessageWithTokenPayload(
  sender: string,
  destinationChain: string,
  txHash: string,
  logIndex: number,
  payload: string
) {
  return [
    {
      typeUrl: `/${AxelarProtobufPackage}.ExecuteGeneralMessageWithTokenRequest`,
      value: ExecuteGeneralMessageWithTokenRequest.fromPartial({
        sender: toAccAddress(sender),
        chain: destinationChain,
        payload: fromHex(payload.slice(2)),
        id: `${txHash}-${logIndex}`,
      }),
    },
  ];
}

export function getMsgIBCTransfer(
  senderAddress: string,
  recipientAddress: string,
  sourceChannel: string,
  amount: string
) {
    const sourcePort = "transfer";
    const timeoutHeight: Height = {
      revisionHeight: Long.fromNumber(100),
      revisionNumber: Long.fromNumber(100)
    };
    const sendToken: Coin = {
      amount,
      denom: 'uusda'
    };
  return {
    typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    value: MsgTransfer.fromPartial({
      sourcePort: sourcePort,
      sourceChannel: sourceChannel,
      sender: senderAddress,
      receiver: recipientAddress,
      token: sendToken,
      timeoutHeight
    })
  };
}

// function get(
//   senderAddress: string,
//   signer: SigningStargateClient
// ) {
//     const fee = {
//       gas: "100000",
//       amount: [{ denom: "uvx", amount: "30000" }]
//     }
//     return signer.sign(senderAddress, [transferMsg], fee, "");
//   }
