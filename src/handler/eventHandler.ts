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

export async function handleReceiveGMPEvm(
  vxClient: AxelarClient,
  event: EvmEvent<ContractCallWithTokenEventObject>
) {
  logger.info(`Received event ${JSON.stringify(event)}`);
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
  logger.info(`Confirmed: ${confirmTx.transactionHash}`);
  await vxClient.pollUntilContractCallWithTokenConfirmed(
    config.evm['ganache-0'].name,
    `${event.hash}-${event.logIndex}`
  );

  // Sent an execute tx to devnet-vx
  const executeTx = await vxClient.executeGeneralMessageWithToken(
    event.args.destinationChain,
    event.logIndex,
    event.hash,
    event.args.payload
  );
  logger.info(`Executed: ${executeTx.transactionHash}`);
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
  logger.info(`Updated to db: ${JSON.stringify(updatedData)}`);
}

export async function handleReceiveGMPCosmos(
  vxClient: AxelarClient,
  evmClient: EvmClient,
  event: IBCEvent<ContractCallWithTokenEventObject>
) {
  // save something to the db.
  // - can we get the txhash from the event?
  // - get the payload hash from the event
  // - get the payload from the event
  await prisma.relayData.create({
    data: {
      id: `${event.hash}`,
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

  logger.info(`pending commands: ${JSON.stringify(pendingCommands)}`);
  if (pendingCommands.length === 0) return;

  const signCommand = await vxClient.signCommands(event.args.destinationChain);
  const batchedCommandId = getBatchCommandIdFromSignTx(signCommand);
  logger.info(`batched command id: ${batchedCommandId}`);

  const executeData = await vxClient.getExecuteDataFromBatchCommands(
    event.args.destinationChain,
    batchedCommandId
  );

  logger.info(`Batch commands: ${JSON.stringify(executeData)}`);

  const tx = await evmClient.execute(executeData);
  logger.info(`Execute: ${tx.transactionHash}`);

  // update relay data
  await prisma.relayData.update({
    where: {
      id: `${event.hash}`,
    },
    data: {
      executeHash: tx.transactionHash,
      status: 1,
    },
  });
}

export async function handleReceiveGMPApproveEvm(
  evmClient: EvmClient,
  event: EvmEvent<ContractCallApprovedWithMintEventObject>
) {
  logger.info(
    `Received event handleReceiveGMPApproveEvm: ${JSON.stringify(event)}}`
  );
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
      `Cannot find payload from given payloadHash: ${payloadHash}`
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

  logger.info('execute with token', tx);

  const executeWithTokenDb = await prisma.relayData.update({
    where: {
      id,
    },
    data: {
      status: 2,
      updatedAt: new Date(),
    },
  });

  logger.info(`execute with token db ${JSON.stringify(executeWithTokenDb)}`);
}

export async function handleCompleteGMPCosmos(
  demoClient: AxelarClient,
  event: IBCPacketEvent
) {
  const recipientAddress = 'axelar199km5vjuu6edyjlwx62wvmr6uqeghyz4rwmyvk';
  await prisma.relayData.update({
    where: {
      packetSequence: event.sequence,
    },
    data: {
      executeHash: event.hash,
      status: 2,
      updatedAt: new Date(),
    },
  });

  if (env.DEV) {
    demoClient
      .getBalance(
        recipientAddress,
        'ibc/52E89E856228AD91E1ADE256E9EDEA4F2E147A426E14F71BE7737EB43CA2FCC5'
      )
      .then((balance) => {
        logger.info(`Balance:${balance}`);
      });
  }
}

export async function prepareHandler() {
  // reconnect prisma db
  await prisma.$connect();
}
