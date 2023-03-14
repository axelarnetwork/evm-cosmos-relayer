import {
  AxelarClient,
  ContractCallApprovedWithMintEventObject,
  ContractCallWithTokenEventObject,
  EvmClient,
  env,
  prisma,
} from '..';
import { logger } from '../logger';
import {
  ContractCallSubmitted,
  ContractCallWithTokenSubmitted,
  EvmEvent,
  IBCEvent,
  IBCPacketEvent,
} from '../types';
import {
  ContractCallApprovedEvent,
  ContractCallApprovedEventObject,
} from '../types/contracts/IAxelarGateway';
import {
  getBatchCommandIdFromSignTx,
  getPacketSequenceFromExecuteTx,
} from '../utils/parseUtils';

export async function handleEvmToCosmosEvent(
  vxClient: AxelarClient,
  event: EvmEvent<ContractCallWithTokenEventObject>
) {
  const id = `${event.hash}-${event.logIndex}`;
  await prisma.relayData.create({
    data: {
      id,
      from: event.sourceChain,
      to: event.destinationChain,
      callContractWithToken: {
        create: {
          payload: event.args.payload,
          payloadHash: event.args.payloadHash,
          contractAddress: event.args.contractAddress,
          sourceAddress: event.args.sender,
          amount: event.args.amount.toString(),
          symbol: event.args.symbol,
        },
      },
    },
  });

  // Sent a confirm tx to testnet-vx
  const confirmTx = await vxClient.confirmEvmTx(
    event.destinationChain,
    event.hash
  );
  logger.info(
    `[handleEvmToCosmosEvent] Confirmed: ${confirmTx.transactionHash}`
  );

  // Wait for the tx to be confirmed
  await vxClient.pollUntilContractCallWithTokenConfirmed(
    event.sourceChain,
    `${event.hash}-${event.logIndex}`,
    10000
  );

  // Sent an execute tx to testnet
  // Check if the tx is already executed

  const executeTx = await vxClient.executeGeneralMessageWithToken(
    event.logIndex,
    event.hash,
    event.args.payload
  );
  logger.info(
    `[handleEvmToCosmosEvent] Executed: ${executeTx.transactionHash}`
  );
  const packetSequence = getPacketSequenceFromExecuteTx(executeTx);

  // save data to db.
  const updatedData = await prisma.relayData.update({
    where: {
      id,
    },
    data: {
      status: 1,
      packetSequence,
    },
  });
  logger.info(
    `[handleEvmToCosmosEvent] DB Updated: ${JSON.stringify(updatedData)}`
  );
}

export async function handleCosmosToEvmContractCallEvent(
  vxClient: AxelarClient,
  evmClients: EvmClient[],
  event: IBCEvent<ContractCallSubmitted>
) {
  await prisma.relayData.create({
    data: {
      id: `${event.args.messageId}`,
      from: event.args.sourceChain,
      to: event.args.destinationChain,
      status: 0,
      callContract: {
        create: {
          payload: event.args.payload,
          payloadHash: event.args.payloadHash,
          contractAddress: event.args.contractAddress,
          sourceAddress: event.args.sender,
        },
      },
    },
  });

  await relayTxToEvmGateway(vxClient, evmClients, event);
}

export async function handleCosmosToEvmContractCallWithTokenEvent(
  vxClient: AxelarClient,
  evmClients: EvmClient[],
  event: IBCEvent<ContractCallWithTokenSubmitted>
) {
  await prisma.relayData.create({
    data: {
      id: `${event.args.messageId}`,
      from: event.args.sourceChain,
      to: event.args.destinationChain,
      status: 0,
      callContractWithToken: {
        create: {
          payload: event.args.payload,
          payloadHash: event.args.payloadHash,
          contractAddress: event.args.contractAddress,
          sourceAddress: event.args.sender,
          amount: event.args.amount.toString(),
          symbol: event.args.symbol,
        },
      },
    },
  });

  await relayTxToEvmGateway(vxClient, evmClients, event);
}

async function relayTxToEvmGateway<
  T extends ContractCallSubmitted | ContractCallWithTokenSubmitted
>(vxClient: AxelarClient, evmClients: EvmClient[], event: IBCEvent<T>) {
  // Find the evm client associated with event's destination chain
  const evmClient = evmClients.find(
    (client) =>
      client.chainId.toLowerCase() === event.args.destinationChain.toLowerCase()
  );

  // If no evm client found, return
  if (!evmClient) return;

  const pendingCommands = await vxClient.getPendingCommands(
    event.args.destinationChain
  );

  logger.info(
    `[handleCosmosToEvmEvent] PendingCommands: ${JSON.stringify(
      pendingCommands
    )}`
  );
  if (pendingCommands.length === 0) return;

  const signCommand = await vxClient.signCommands(event.args.destinationChain);

  const batchedCommandId = getBatchCommandIdFromSignTx(signCommand);
  logger.info(`[handleCosmosToEvmEvent] BatchCommandId: ${batchedCommandId}`);

  const executeData = await vxClient.getExecuteDataFromBatchCommands(
    event.args.destinationChain,
    batchedCommandId
  );

  logger.info(
    `[handleCosmosToEvmEvent] BatchCommands: ${JSON.stringify(executeData)}`
  );

  const tx = await evmClient.gatewayExecute(executeData);
  if (!tx) return;
  logger.info(`[handleCosmosToEvmEvent] Execute: ${tx.transactionHash}`);

  // update relay data
  const record = await prisma.relayData.update({
    where: {
      id: event.args.messageId,
    },
    data: {
      executeHash: tx.transactionHash,
      status: 1,
    },
  });

  logger.info(`[handleCosmosToEvmEvent] DBUpdate: ${JSON.stringify(record)}`);
}

export async function handleCosmosToEvmCallContractCompleteEvent(
  evmClients: EvmClient[],
  event: EvmEvent<ContractCallApprovedEventObject>
) {
  // Find the evm client associated with event's destination chain
  const evmClient = evmClients.find(
    (client) =>
      client.chainId.toLowerCase() === event.args.sourceChain.toLowerCase()
  );

  // If no evm client found, return
  if (!evmClient) return;

  const {
    commandId,
    contractAddress,
    sourceAddress,
    sourceChain,
    payloadHash,
  } = event.args;

  const relayDatas = await prisma.relayData.findMany({
    where: {
      callContract: {
        payloadHash,
        sourceAddress,
        contractAddress,
      },
      status: 1,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      callContract: {
        select: {
          payload: true,
        },
      },
      id: true,
    },
  });

  if (!relayDatas)
    return logger.info(
      `[handleCosmosToEvmCompleteEvent]: Cannot find payload from given payloadHash: ${payloadHash}`
    );

  // const { payload, id } = data;
  for (const data of relayDatas) {
    const { callContract, id } = data;
    if (!callContract) continue;

    const tx = await evmClient.execute(
      contractAddress,
      commandId,
      sourceChain,
      sourceAddress,
      callContract.payload
    );

    logger.info(
      `[handleCosmosToEvmCompleteEvent] execute: ${JSON.stringify(tx)}`
    );

    const executeDb = await prisma.relayData.update({
      where: {
        id,
      },
      data: {
        status: 2,
        updatedAt: new Date(),
      },
    });

    logger.info(
      `[handleCosmosToEvmCompleteEvent] DBUpdate: ${JSON.stringify(executeDb)}`
    );
  }
}

export async function handleCosmosToEvmCallContractWithTokenCompleteEvent(
  evmClients: EvmClient[],
  event: EvmEvent<ContractCallApprovedWithMintEventObject>
) {
  const {
    amount,
    commandId,
    contractAddress,
    sourceAddress,
    sourceChain,
    symbol,
    payloadHash,
  } = event.args;

  const evmClient = evmClients.find(
    (client) => client.chainId === event.destinationChain
  );
  if (!evmClient) return;

  const relayDatas = await prisma.relayData.findMany({
    where: {
      callContractWithToken: {
        payloadHash: payloadHash,
        sourceAddress: sourceAddress,
        contractAddress: contractAddress,
        amount: amount.toString(),
      },
      status: 1,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      callContractWithToken: {
        select: {
          payload: true,
        },
      },
      id: true,
    },
  });

  if (!relayDatas)
    return logger.info(
      `[handleCosmosToEvmCallContractWithTokenCompleteEvent]: Cannot find payload from given payloadHash: ${payloadHash}`
    );

  for (const relayData of relayDatas) {
    const { callContractWithToken, id } = relayData;
    if (!callContractWithToken) continue;

    const tx = await evmClient.executeWithToken(
      contractAddress,
      commandId,
      sourceChain,
      sourceAddress,
      callContractWithToken.payload,
      symbol,
      amount.toString()
    );

    logger.info(
      `[handleCosmosToEvmCallContractWithTokenCompleteEvent] executeWithToken: ${JSON.stringify(
        tx
      )}`
    );

    const executeWithTokenDb = await prisma.relayData.update({
      where: {
        id,
      },
      data: {
        status: 2,
        updatedAt: new Date(),
      },
    });

    logger.info(
      `[handleCosmosToEvmCompleteEvent] DBUpdate: ${JSON.stringify(
        executeWithTokenDb
      )}`
    );
  }
}

export async function handleEvmToCosmosCompleteEvent(
  client: AxelarClient,
  event: IBCPacketEvent
) {
  const record = await prisma.relayData.update({
    where: {
      packetSequence: event.sequence,
    },
    data: {
      executeHash: event.hash,
      status: 2,
      updatedAt: new Date(),
    },
  });
  logger.info(
    `[handleEvmToCosmosCompleteEvent] DBUpdate: ${JSON.stringify(record)}`
  );

  if (env.DEV) {
    // TODO: Find a way to generalize this check to work with any gmp call.

    const recipientAddress = 'axelar199km5vjuu6edyjlwx62wvmr6uqeghyz4rwmyvk';
    client
      .getBalance(
        recipientAddress,
        'ibc/52E89E856228AD91E1ADE256E9EDEA4F2E147A426E14F71BE7737EB43CA2FCC5'
      )
      .then((balance) => {
        logger.info(`Balance: ${JSON.stringify(balance)}`);
      });
  }
}

export async function prepareHandler(event: any, label = '') {
  // reconnect prisma db
  await prisma.$connect();

  // log event
  logger.info(`[${label}] EventReceived ${JSON.stringify(event)}`);
}
