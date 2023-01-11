import { IbcClient, SigningClient, config } from ".."

async function main() {
  const signingClient = await SigningClient.init(config.cosmos.demo)

  const client = new IbcClient(signingClient)
  console.log("Sending TX");
  const tx = await client.sendGMPIbc(signingClient.getAddress(), ["0x1a71552966E3cd8e7D013a86461c60E10b1BEC09"], "Ganache-0", "0x873424B4cf0E6AF4d8402ee05Ed7CC324307df47", "10000")
  console.log("Sent", tx)

}

main()
