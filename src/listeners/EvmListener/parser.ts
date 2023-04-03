import { ethers } from 'ethers';
import { filterEventArgs } from '../../utils/operatorUtils';
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
    sourceChain: event.args.sourceChain,
    destinationChain: currentChainName,
    waitForFinality: () => {
      return provider.waitForTransaction(event.transactionHash, finalityBlocks);
    },
    args: filterEventArgs(event),
  };
};
