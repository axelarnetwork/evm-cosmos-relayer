import { SigningClient } from ".";
import { getMsgIBCTransfer } from "../utils/payloadBuilder";
import {ethers} from 'ethers'

export class IbcClient {
  private signingClient: SigningClient;


  constructor(_signingClient: SigningClient) {
    this.signingClient = _signingClient;
  }

  public sendGMPIbc(sender: string, recipients: string[], destChain: string, destAddress: string, amount: string) {
    // create gmp metadata
    const encodedAddresses = ethers.utils.defaultAbiCoder.encode(["address[]"], [recipients]);
    // create ibc payload
    const metadata = {
      sender: sender,
      dest_chain: destChain,
      dest_address: destAddress,
      payload: encodedAddresses,
      type: "/axelar.axelarnet.v1beta1.GeneralMsgWithToken",
    }

    const buffer: Buffer = Buffer.from(JSON.stringify(metadata));
    const memo = buffer.toString("hex")

    const payload = getMsgIBCTransfer(sender, "channel-17", amount, memo)

    console.log(this.signingClient.getAddress())

    return this.signingClient.broadcast(payload);
  }

}
