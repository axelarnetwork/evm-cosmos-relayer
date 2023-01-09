import { ContractCallWithTokenEventObject } from "./contracts/IAxelarGatewayAbi";

export interface ContractCallWithTokenListenerEvent {
  hash: string;
  blockNumber: number;
  logIndex: number;
  args: ContractCallWithTokenEventObject;
}

export interface IBCPacketEvent {
  hash: string;
  srcChannel: string;
  destChannel: string;
  denom: string;
  amount: string;
  sequence: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  orderBy: {
    created_at: 'asc' | 'desc';
    updated_at: 'asc' | 'desc';
  },
  completed: boolean;
}
