import { Coin } from '@cosmjs/stargate';
import { Height } from 'cosmjs-types/ibc/core/client/v1/client';

export interface EvmEvent<T> {
  hash: string;
  blockNumber: number;
  logIndex: number;
  args: T;
}

export interface IBCPacketEvent {
  hash: string;
  srcChannel: string;
  destChannel: string;
  denom: string;
  amount: string;
  sequence: number;
}

export interface IBCGMPEvent<T> {
  hash: string;
  srcChannel: string;
  destChannel: string;
  args: T
}

export interface PaginationParams {
  page: number;
  limit: number;
  orderBy: {
    createdAt: 'asc' | 'desc';
    updatedAt: 'asc' | 'desc';
  };
  completed: boolean;
}

export interface LinkRequest {
  sender: Uint8Array;
  chain: string;
  recipientAddr: string;
  asset: string;
  recipientChain: string;
}

export interface MsgTransfer {
  /** the port on which the packet will be sent */
  sourcePort: string;
  /** the channel by which the packet will be sent */

  sourceChannel: string;
  /** the tokens to be transferred */

  token?: Coin;
  /** the sender address */

  sender: string;
  /** the recipient address on the destination chain */

  receiver: string;
  /**
   * Timeout height relative to the current block height.
   * The timeout is disabled when set to 0.
   */

  timeoutHeight?: Height;
  /**
   * Timeout timestamp in absolute nanoseconds since unix epoch.
   * The timeout is disabled when set to 0.
   */

  timeoutTimestamp: Long;

  memo: string;
}
