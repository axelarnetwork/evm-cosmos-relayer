import { SigningClient } from ".";
import { getMsgIBCTransfer } from "../utils/payloadBuilder";
import {Metadata, Metadata_Type} from '@axelar-network/axelarjs-types/axelar/axelarnet/v1beta1/gmp'
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
    const _payload = Uint8Array.from(Buffer.from(encodedAddresses.slice(2), "hex"));

    const metadata = Metadata.fromPartial({
      sender: sender,
      sourceChain: "demo-chain",
      destChain: destChain,
      destAddress: destAddress,
      payload: _payload,
      type: Metadata_Type.TYPE_GENERAL_MESSAGE_WITH_TOKEN,
    })

    const payload = getMsgIBCTransfer(sender, "channel-1", amount, Metadata.encode(metadata).finish())

    console.log("Payload", JSON.stringify(payload))

    console.log(this.signingClient.getAddress())

    return this.signingClient.broadcast(payload);
  }

}
// 7b2273656e646572223a226178656c6172313939376b6d3576a75655665796a6c7778363277766d72367175656768797a3472776d796b222c22736f757263655f636861696e223a2264656d6f2d636861696e222c22646573745f636861696e223a2247616e616368652d30222c22646573745f6164617074657273a
// 7b2273656e646572223a226178656c61723139396b6d35766a7575366564796a6c7778363277766d72367571656768797a3472776d79766b222c22736f757263655f636861696e223a2264656d6f2d636861696e222c22646573745f636861696e223a2247616e616368652d30222c22646573745f61646472657373223a22307838373334323442346366304536414634643834303265653035456437434333323433303764663437222c227061796c6f6164223a223078303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303032303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303130303030303030303030303030303030303030303030303031613731353532393636653363643865376430313361383634363163363065313062316265633039222c2274797065223a222f6178656c61722e6178656c61726e65742e763162657461312e47656e6572616c4d736757697468546f6b656e227d
