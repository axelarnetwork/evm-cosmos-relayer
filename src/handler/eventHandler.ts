import {
  AxelarClient,
  ContractCallApprovedWithMintEventObject,
  ContractCallWithTokenEventObject,
  EvmClient,
  config,
  env,
  prisma,
} from '..';
import { logger } from '../logger';
import { EvmEvent, IBCEvent, IBCPacketEvent } from '../types';
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
      from: 'ganache-0',
      to: 'demo-chain',
      callContractWithToken: {
        create: {
          payload: event.args.payload,
          payloadHash: event.args.payloadHash,
          contractAddress: event.args.destinationContractAddress,
          sourceAddress: event.args.sender,
          amount: event.args.amount.toString(),
          symbol: event.args.symbol,
        },
      },
    },
  });

  // Sent a confirm tx to devnet-vx
  const confirmTx = await vxClient.confirmEvmTx(
    config.evm['ganache-0'].name,
    event.hash
  );
  logger.info(
    `[handleEvmToCosmosEvent] Confirmed: ${confirmTx.transactionHash}`
  );
  await vxClient.pollUntilContractCallWithTokenConfirmed(
    config.evm['ganache-0'].name,
    `${event.hash}-${event.logIndex}`
  );

  // Sent an execute tx to devnet-vx
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

export async function handleCosmosToEvmEvent(
  vxClient: AxelarClient,
  evmClient: EvmClient,
  event: IBCEvent<ContractCallWithTokenEventObject>
) {
  await prisma.relayData.create({
    data: {
      id: `${event.hash}-0`,
      from: 'demo-chain',
      to: 'ganache-0',
      status: 0,
      callContractWithToken: {
        create: {
          payload: event.args.payload,
          payloadHash: event.args.payloadHash,
          contractAddress: event.args.destinationContractAddress,
          sourceAddress: event.args.sender,
          amount: event.args.amount.toString(),
          symbol: event.args.symbol,
        },
      },
    },
  });

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

  const tx = await evmClient.execute(executeData);
  if (!tx) return;
  logger.info(`[handleCosmosToEvmEvent] Execute: ${tx.transactionHash}`);

  // update relay data
  const record = await prisma.relayData.update({
    where: {
      id: `${event.hash}`,
    },
    data: {
      executeHash: tx.transactionHash,
      status: 1,
    },
  });

  logger.info(`[handleCosmosToEvmEvent] DBUpdate: ${JSON.stringify(record)}`);
}

export async function handleCosmosToEvmCompleteEvent(
  evmClient: EvmClient,
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

  const data = await prisma.callContractWithToken.findFirst({
    where: {
      payloadHash,
      sourceAddress,
      contractAddress,
      amount: amount.toString(),
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      payload: true,
      id: true,
    },
  });

  if (!data)
    return logger.info(
      `[handleCosmosToEvmCompleteEvent]: Cannot find payload from given payloadHash: ${payloadHash}`
    );

  const { payload, id } = data;

  const tx = await evmClient.executeWithToken(
    contractAddress,
    commandId,
    sourceChain,
    sourceAddress,
    payload,
    symbol,
    amount.toString()
  );

  logger.info(
    `[handleCosmosToEvmCompleteEvent] executeWithToken: ${JSON.stringify(tx)}`
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

export async function handleEvmToCosmosCompleteEvent(
  demoClient: AxelarClient,
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
    const recipientAddress = 'axelar199km5vjuu6edyjlwx62wvmr6uqeghyz4rwmyvk';
    demoClient
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
