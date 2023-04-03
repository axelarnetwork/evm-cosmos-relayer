import {
  ConfirmGatewayTxRequest as EvmConfirmGatewayTxRequest,
  protobufPackage as EvmProtobufPackage,
  SignCommandsRequest as EvmSignCommandsRequest,
} from '@axelar-network/axelarjs-types/axelar/evm/v1beta1/tx';
import {
  MsgTransfer,
  protobufPackage,
} from '@axelar-network/axelarjs-types/ibc/applications/transfer/v1/tx';
// import {} from "@axelar-network/axelarjs-types/axelar/evm/v1beta1/event";
import { Height } from 'cosmjs-types/ibc/core/client/v1/client';
import {
  ExecuteMessageRequest,
  protobufPackage as AxelarProtobufPackage,
} from '@axelar-network/axelarjs-types/axelar/axelarnet/v1beta1/tx';
import { toAccAddress } from '@cosmjs/stargate/build/queryclient/utils';
import { fromHex } from '@cosmjs/encoding';
import { utils } from 'ethers';
import { Coin } from '@cosmjs/stargate';
import Long from 'long';
// import { logger } from '../logger';

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

export function getRouteMessageRequest(
  sender: string,
  txHash: string,
  logIndex: number,
  payload: string
) {
  return [
    {
      typeUrl: `/${AxelarProtobufPackage}.RouteMessageRequest`,
      value: ExecuteMessageRequest.fromPartial({
        sender: toAccAddress(sender),
        payload: fromHex(payload.slice(2)),
        id: logIndex === -1 ? `${txHash}` : `${txHash}-${logIndex}`,
      }),
    },
  ];
}

export function getSignCommandPayload(sender: string, chain: string) {
  return [
    {
      typeUrl: `/${EvmProtobufPackage}.SignCommandsRequest`,
      value: EvmSignCommandsRequest.fromPartial({
        sender: toAccAddress(sender),
        chain,
      }),
    },
  ];
}

export function getMsgIBCTransfer(
  senderAddress: string,
  sourceChannel: string,
  amount: string,
  memo: Uint8Array
) {
  const axelarModuleAccount = 'axelar19xj4ncc6h6y5ahpfqtspdx75y3dkrxj3zpah9k';
  const sourcePort = 'transfer';
  const timeoutHeight: Height = {
    revisionHeight: Long.fromNumber(100),
    revisionNumber: Long.fromNumber(100),
  };
  const sendToken: Coin = {
    amount,
    denom:
      'ibc/52E89E856228AD91E1ADE256E9EDEA4F2E147A426E14F71BE7737EB43CA2FCC5',
  };

  return [
    {
      typeUrl: `/${protobufPackage}.MsgTransfer`,
      value: MsgTransfer.fromPartial({
        sourcePort,
        sourceChannel,
        sender: senderAddress,
        receiver: axelarModuleAccount,
        token: sendToken,
        timeoutHeight,
        memo: Buffer.from(memo).toString('hex'),
      }),
    },
  ];
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
