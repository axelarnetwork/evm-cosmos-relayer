import { ethers } from 'ethers';
import { IbcClient, SigningClient, config, env } from '..';

async function main() {
  const signingClient = await SigningClient.init(config.cosmos.demo);

  const wallet = new ethers.Wallet(env.EVM_PRIVATE_KEY);
  const client = new IbcClient(signingClient);
  const destinationContractAddress =
    '0x873424B4cf0E6AF4d8402ee05Ed7CC324307df47';
  const destinationChain = 'Ganache-0';
  const amount = '10000';

  const tx = await client.sendGMPIbc(
    signingClient.getAddress(),
    [wallet.address],
    destinationChain,
    destinationContractAddress,
    amount
  );

  console.log('Sent', tx);
}

main();
