import { GMPListenerClient, AxelarClient, EvmClient } from './clients';
import { config } from './config';
import hapi, { Request } from '@hapi/hapi';
import Joi from 'joi';
import { Subject, filter } from 'rxjs';
import {
  EvmEvent,
  IBCGMPEvent,
  IBCPacketEvent,
  PaginationParams,
} from './types';
import { ContractCallWithTokenEventObject } from './types/contracts/IAxelarGatewayAbi';
import {
  getBatchCommandIdFromSignTx,
  getPacketSequenceFromExecuteTx,
} from './utils/parseUtils';
import { prisma } from './clients';
import { ContractCallApprovedWithMintEventObject } from './types/contracts/IAxelarGateway';

const initServer = async () => {
  const server = hapi.server({
    port: 3000,
    host: 'localhost',
  });

  server.route({
    method: 'GET',
    path: '/relayTx',
    handler: async (request) => {
      const { txHash, logIndex } = request.query;
      const data = await prisma.relayData.findFirst({
        where: {
          id: `${txHash}-${logIndex}`,
        },
      });

      if (!data) {
        return {
          success: false,
          data: null,
          error: 'No data found',
        };
      }

      return {
        success: true,
        payload: data,
      };
    },
  });

  // get all relay data in pagination
  server.route({
    method: 'POST',
    path: '/relayTx.all',
    options: {
      auth: false,
      validate: {
        payload: Joi.object({
          page: Joi.number().integer().min(0).default(0),
          limit: Joi.number().integer().min(1).max(100).default(10),
          orderBy: Joi.object()
            .keys({
              createdAt: Joi.string().valid('asc', 'desc').default('desc'),
              updatedAt: Joi.string().valid('asc', 'desc').default('desc'),
            })
            .default({
              updatedAt: 'desc',
            }),
          completed: Joi.boolean().default(true),
        }).options({ stripUnknown: true }),
      },
    },
    handler: async (request: Request) => {
      const payload = request.payload as PaginationParams;
      const { page, limit, orderBy, completed } = payload;

      const filtering = completed
        ? {
            status: 2,
          }
        : {
            status: {
              not: 2,
            },
          };
      const data = await prisma.relayData.findMany({
        skip: page * limit,
        take: limit,
        orderBy,
        where: filtering,
      });

      return {
        success: true,
        payload: {
          data,
          page,
          total: data.length,
        },
      };
    },
  });

  await server.start();
  console.log('Server running on %s', server.info.uri);
};

async function main() {
  const recipientAddress = 'axelar199km5vjuu6edyjlwx62wvmr6uqeghyz4rwmyvk';
  const evm = config.evm['ganache-0'];
  const observedDestinationChains = [config.cosmos.demo.chainId];
  const listener = new GMPListenerClient(evm.rpcUrl, evm.gateway);
  const vxClient = await AxelarClient.init(config.cosmos.devnet);
  const demoClient = await AxelarClient.init(config.cosmos.demo);
  const evmClient = new EvmClient(config.evm['ganache-0']);

  // Create an event subject for ContractCallWithTokenListenerEvent
  const contractCallWithTokenSubject = new Subject<
    EvmEvent<ContractCallWithTokenEventObject>
  >();
  const contractCallApprovedWithMintSubject = new Subject<
    EvmEvent<ContractCallApprovedWithMintEventObject>
  >();

  // Pass the subject to the event listener, so that the listener can push events to the subject
  listener.listenEVM(
    contractCallWithTokenSubject,
    contractCallApprovedWithMintSubject
  );

  // Filter events by destination chain
  const evmToCosmosObservable = contractCallWithTokenSubject.pipe(
    filter((event) =>
      observedDestinationChains.includes(event.args.destinationChain)
    )
  );

  // Subscribe to the observable to execute txs on Axelar for relaying to Cosmos
  evmToCosmosObservable.subscribe(async (event) => {
    console.log('Received event:', event);

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
    const packetSeq = getPacketSequenceFromExecuteTx(executeTx);

    // save data to db.
    await prisma.relayData.create({
      data: {
        id: `${event.hash}-${event.logIndex}`,
        packetSequence: packetSeq,
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
  });

  // Subscribe CosmosToEvm
  contractCallApprovedWithMintSubject.subscribe(async (event) => {
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
  });

  const cosmosSubject = new Subject<
    IBCGMPEvent<ContractCallWithTokenEventObject>
  >();
  cosmosSubject.subscribe(async (event) => {
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

    const signCommand = await vxClient.signCommands(
      event.args.destinationChain
    );
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
  });

  // listen for cosmos gmp
  vxClient.listenForCosmosGMP(cosmosSubject);

  // Listen for IBC packet events
  const ibcSubject = new Subject<IBCPacketEvent>();

  vxClient.listenForIBCComplete(ibcSubject);

  ibcSubject.subscribe(async (event) => {
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

    if (process.env.DEV) {
      demoClient
        .getBalance(
          recipientAddress,
          'ibc/52E89E856228AD91E1ADE256E9EDEA4F2E147A426E14F71BE7737EB43CA2FCC5'
        )
        .then((balance) => {
          console.log('Balance:', balance);
        });
    }
  });

  await initServer();
}

console.log('Starting relayer server...');
main();
