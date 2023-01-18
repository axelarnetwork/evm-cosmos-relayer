import { SigningClient } from '.';
import { logger } from '../logger';
import { getMsgIBCTransfer } from '../utils/payloadBuilder';
import {
  Metadata,
  Metadata_Type,
} from '@axelar-network/axelarjs-types/axelar/axelarnet/v1beta1/gmp';
import { ethers } from 'ethers';

export class IbcClient {
  private signingClient: SigningClient;

  constructor(_signingClient: SigningClient) {
    this.signingClient = _signingClient;
  }

  public sendGMPIbc(
    sender: string,
    recipients: string[],
    destChain: string,
    destAddress: string,
    amount: string
  ) {
    // create gmp metadata
    const encodedAddresses = ethers.utils.defaultAbiCoder.encode(
      ['address[]'],
      [recipients]
    );
    // create ibc payload
    const _payload = Uint8Array.from(
      Buffer.from(encodedAddresses.slice(2), 'hex')
    );

    const metadata = Metadata.fromPartial({
      sender: sender,
      sourceChain: 'demo-chain',
      destChain: destChain,
      destAddress: destAddress,
      payload: _payload,
      // type: Metadata_Type.TYPE_GENERAL_MESSAGE_WITH_TOKEN,
    });

    const payload = getMsgIBCTransfer(
      sender,
      'channel-1',
      amount,
      Metadata.encode(metadata).finish()
    );

    return this.signingClient.broadcast(payload);
  }
}
