import { ContractCallWithTokenEventObject } from "../types/contracts/IAxelarGatewayAbi";

export interface ContractCallWithTokenListenerEvent {
  hash: string;
  blockNumber: number;
  logIndex: number;
  args: ContractCallWithTokenEventObject;
}
