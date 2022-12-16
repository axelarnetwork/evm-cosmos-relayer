import {
  ConfirmGatewayTxRequest as EvmConfirmGatewayTxRequest,
  protobufPackage as EvmProtobufPackage,
} from "@axelar-network/axelarjs-types/axelar/evm/v1beta1/tx";
import {
  ExecuteGeneralMessageWithTokenRequest,
  protobufPackage as AxelarProtobufPackage,
} from "@axelar-network/axelarjs-types/axelar/axelarnet/v1beta1/tx";
import { toAccAddress } from "@cosmjs/stargate/build/queryclient/utils";
import { fromHex } from "@cosmjs/encoding";
import { utils } from "ethers";

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
