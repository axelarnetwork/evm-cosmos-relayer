import { ethers } from 'ethers';
import { TypedEvent } from '../../types/contracts/common';

export const parseAnyEvent = async (
  currentChainName: string,
  provider: ethers.providers.Provider,
  event: TypedEvent,
  finalityBlocks = 1
) => {
  const receipt = await event.getTransactionReceipt();
  const eventIndex = receipt.logs.findIndex(
    (log) => log.logIndex === event.logIndex
  );

  return {
    hash: event.transactionHash,
    blockNumber: event.blockNumber,
    logIndex: eventIndex,
    sourceChain: event.args.sourceChain || currentChainName,
    destinationChain: event.args.destinationChain || currentChainName,
    waitForFinality: () => {
      return provider.waitForTransaction(event.transactionHash, finalityBlocks);
    },
    args: filterEventArgs(event),
  };
};


const filterEventArgs = (event: TypedEvent) => {
  return Object.entries(event.args).reduce((acc, [key, value]) => {
    if (!isNaN(Number(key))) return acc;
    acc[key] = value;
    return acc;
  }, {} as any);
};
