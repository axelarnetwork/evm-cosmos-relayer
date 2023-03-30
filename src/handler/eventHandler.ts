import { PrismaClient } from '@prisma/client';
import { AxelarClient, DatabaseClient, EvmClient, env } from '..';
import { logger } from '../logger';
import {
  ContractCallSubmitted,
  ContractCallWithTokenSubmitted,
  EvmEvent,
  ExecuteRequest,
  IBCEvent,
  IBCPacketEvent,
  Status,
} from '../types';
import {
  ContractCallApprovedWithMintEventObject,
  ContractCallWithTokenEventObject,
  ContractCallApprovedEventObject,
  ContractCallEventObject,
} from '../types/contracts/IAxelarGateway';
import {
  getBatchCommandIdFromSignTx,
  getPacketSequenceFromExecuteTx,
} from '../utils/parseUtils';

export async function handleEvmToCosmosConfirmEvent(
  vxClient: AxelarClient,
  executeParams: ExecuteRequest
) {
  const { id, payload } = executeParams;
  const [hash, logIndex] = id.split('-');

  const executeTx = await vxClient.routeMessageRequest(
    parseInt(logIndex),
    hash,
    payload
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
      status: Status.SUCCESS,
      packetSequence,
    },
  });
  logger.info(
    `[handleEvmToCosmosEvent] DB Updated: ${JSON.stringify(updatedData)}`
  );
}

export async function handleEvmToCosmosEvent(
  vxClient: AxelarClient,
  event: EvmEvent<ContractCallWithTokenEventObject | ContractCallEventObject>
) {
  const confirmTx = await vxClient.confirmEvmTx(event.sourceChain, event.hash);
  logger.info(
    `[handleEvmToCosmosEvent] Confirmed: ${confirmTx.transactionHash}`
  );
}

export async function handleCosmosToEvmEvent<
  T extends ContractCallSubmitted | ContractCallWithTokenSubmitted
>(vxClient: AxelarClient, evmClients: EvmClient[], event: IBCEvent<T>) {
  // Find the evm client associated with event's destination chain
  const evmClient = evmClients.find(
    (client) =>
      client.chainId.toLowerCase() === event.args.destinationChain.toLowerCase()
  );

  // If no evm client found, return
  if (!evmClient) return;

  const routeMessage = await vxClient.routeMessageRequest(
    -1,
    event.args.messageId,
    event.args.payload
  );

  logger.info(
    `[handleCosmosToEvmEvent] RouteMessage: ${routeMessage.transactionHash}`
  );

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

  return tx;
}

export async function handleCosmosToEvmCallContractCompleteEvent(
  evmClients: EvmClient[],
  prisma: PrismaClient,
  event: EvmEvent<ContractCallApprovedEventObject>
) {
  // Find the evm client associated with event's destination chain
  const evmClient = evmClients.find(
    (client) =>
      client.chainId.toLowerCase() === event.destinationChain.toLowerCase()
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
      status: Status.APPROVED,
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
      `[handleCosmosToEvmCallContractCompleteEvent]: Cannot find payload from given payloadHash: ${payloadHash}`
    );

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

    if (!tx) {
      logger.info([
        '[handleCosmosToEvmCallContractCompleteEvent] execute failed',
        id,
      ]);
      await prisma.relayData.update({
        where: {
          id,
        },
        data: {
          status: Status.FAILED,
          updatedAt: new Date(),
        },
      });
      continue;
    }

    logger.info(
      `[handleCosmosToEvmCallContractCompleteEvent] execute: ${JSON.stringify(
        tx
      )}`
    );

    const executeDb = await prisma.relayData.update({
      where: {
        id,
      },
      data: {
        status: Status.SUCCESS,
        updatedAt: new Date(),
      },
    });

    logger.info(
      `[handleCosmosToEvmCallContractCompleteEvent] DBUpdate: ${JSON.stringify(
        executeDb
      )}`
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
      status: Status.APPROVED,
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

    if (!tx) {
      logger.info([
        '[handleCosmosToEvmCallContractWithTokenCompleteEvent] executeWithToken failed',
        id,
      ]);
      await prisma.relayData.update({
        where: {
          id,
        },
        data: {
          status: Status.FAILED,
          updatedAt: new Date(),
        },
      });
      continue;
    }

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
        status: Status.SUCCESS,
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
  // const record = await prisma.relayData
  //   .update({
  //     where: {
  //       packetSequence: event.sequence,
  //     },
  //     data: {
  //       status: Status.SUCCESS,
  //       executeHash: event.hash,
  //       updatedAt: new Date(),
  //     },
  //   })
  //   .catch((err: any) => {
  //     logger.error(`[handleEvmToCosmosCompleteEvent] ${err.message}`);
  //   });
  // logger.info(
  //   `[handleEvmToCosmosCompleteEvent] DBUpdate: ${JSON.stringify(record)}`
  // );

  logger.info(`[handleEvmToCosmosCompleteEvent] Memo: ${event.memo}`);
}

export async function prepareHandler(
  event: any,
  db: DatabaseClient,
  label = ''
) {
  // reconnect prisma db
  await db.connect();

  // log event
  logger.info(`[${label}] EventReceived ${JSON.stringify(event)}`);
}
