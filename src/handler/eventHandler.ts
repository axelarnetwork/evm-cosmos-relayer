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

  const executeTx = await vxClient.executeMessageRequest(
    parseInt(logIndex),
    hash,
    payload
  );

  if (!executeTx) {
    return {
      status: Status.FAILED,
    };
  }

  logger.info(
    `[handleEvmToCosmosEvent] Executed: ${executeTx.transactionHash}`
  );
  const packetSequence = getPacketSequenceFromExecuteTx(executeTx);

  return {
    status: Status.SUCCESS,
    packetSequence,
  };
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

  // TODO: Remove this when it's live on testnet
  if (env.CHAIN_ENV === 'devnet') {
    const executeMessage = await vxClient.executeMessageRequest(
      -1,
      event.args.messageId,
      event.args.payload
    );

    logger.info(
      `[handleCosmosToEvmEvent] Executed: ${executeMessage.transactionHash}`
    );
  }

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
  evmClient: EvmClient,
  event: EvmEvent<ContractCallApprovedEventObject>,
  relayDatas: { id: string; payload: string | undefined }[]
) {
  const {
    commandId,
    contractAddress,
    sourceAddress,
    sourceChain,
    payloadHash,
  } = event.args;

  if (!relayDatas) {
    logger.info(
      `[handleCosmosToEvmCallContractCompleteEvent]: Cannot find payload from given payloadHash: ${payloadHash}`
    );
    return undefined;
  }

  const result = [];
  for (const data of relayDatas) {
    const { payload, id } = data;
    if (!payload) continue;

    const tx = await evmClient.execute(
      contractAddress,
      commandId,
      sourceChain,
      sourceAddress,
      payload
    );

    if (!tx) {
      result.push({
        id,
        status: Status.FAILED,
      });
      logger.error(
        `[handleCosmosToEvmCallContractCompleteEvent] execute failed: ${id}`
      );
      continue;
    }

    logger.info(
      `[handleCosmosToEvmCallContractCompleteEvent] execute: ${JSON.stringify(
        tx
      )}`
    );

    result.push({
      id,
      status: Status.SUCCESS,
    });
  }

  return result;
}

export async function handleCosmosToEvmCallContractWithTokenCompleteEvent(
  evmClient: EvmClient,
  event: EvmEvent<ContractCallApprovedWithMintEventObject>,
  relayDatas: { id: string; payload: string | undefined }[]
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

  if (!relayDatas) {
    logger.info(
      `[handleCosmosToEvmCallContractWithTokenCompleteEvent]: Cannot find payload from given payloadHash: ${payloadHash}`
    );
    return undefined;
  }

  const result = [];
  for (const relayData of relayDatas) {
    const { payload, id } = relayData;
    if (!payload) continue;

    const tx = await evmClient.executeWithToken(
      contractAddress,
      commandId,
      sourceChain,
      sourceAddress,
      payload,
      symbol,
      amount.toString()
    );

    if (!tx) {
      logger.info([
        '[handleCosmosToEvmCallContractWithTokenCompleteEvent] executeWithToken failed',
        id,
      ]);

      result.push({
        id,
        status: Status.FAILED,
      });

      continue;
    }

    logger.info(
      `[handleCosmosToEvmCallContractWithTokenCompleteEvent] executeWithToken: ${JSON.stringify(
        tx
      )}`
    );

    result.push({
      id,
      status: Status.SUCCESS,
    });
  }

  return result;
}

export async function handleEvmToCosmosCompleteEvent(
  client: AxelarClient,
  event: IBCPacketEvent
) {
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
