import { ethers } from "ethers";

export async function getCallContractWithTokenDetails(
  provider: ethers.providers.Provider,
  txHash: string
) {
  // TODO: create ethers filter to get the logs of the txHash
  const receipt = await provider.getTransactionReceipt(txHash);
  // for(const log of receipt.logs) {
  //   console.log(log)
  //   if(log.topics === [])
  // }
}
