import {
  AxelarClient,
  ContractCallApprovedWithMintEventObject,
  ContractCallWithTokenEventObject,
  EvmClient,
  config,
  env,
  prisma,
} from '..';
import { EvmEvent, IBCEvent, IBCPacketEvent } from '../types';
import {
  getBatchCommandIdFromSignTx,
  getPacketSequenceFromExecuteTx,
} from '../utils/parseUtils';

export async function handleReceiveGMPEvm(
  vxClient: AxelarClient,
  event: EvmEvent<ContractCallWithTokenEventObject>
) {
  const id = `${event.hash}-${event.logIndex}`;
  const tx1 = await prisma.relayData.create({
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
  console.log('Received event, saved to the db:', tx1);

  // Sent a confirm tx to devnet-vx
  const confirmTx = await vxClient.confirmEvmTx(
    config.evm['ganache-0'].name,
    event.hash
  );
  console.log('Confirmed:', confirmTx.transactionHash);
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
  console.log('Executed:', executeTx.transactionHash);
  const packetSequence = getPacketSequenceFromExecuteTx(executeTx);

  // save data to db.
  const tx2 = await prisma.relayData.update({
    where: {
      id,
    },
    data: {
      status: 1,
      packetSequence,
    },
  });
  console.log('updated the status to 1', tx2);
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

  console.log('pending commands:', pendingCommands);
  if (pendingCommands.length === 0) return;

  const signCommand = await vxClient.signCommands(event.args.destinationChain);
  const batchedCommandId = getBatchCommandIdFromSignTx(signCommand);
  console.log('batched command id :', batchedCommandId);

  const executeData = await vxClient.getExecuteDataFromBatchCommands(
    event.args.destinationChain,
    batchedCommandId
  );

  console.log('batch commands:', executeData);

  const tx = await evmClient.execute(executeData);
  console.log('execute:', tx);

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
  console.log('Received event execute:', event);
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
    return console.log(
      'cannot find payload from given payloadHash:',
      payloadHash
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

  console.log('execute with token', tx);

  const executeWithTokenDb = await prisma.relayData.update({
    where: {
      id,
    },
    data: {
      status: 2,
      updatedAt: new Date(),
    },
  });

  console.log('execute with token db', executeWithTokenDb);
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
        console.log('Balance:', balance);
      });
  }
}
