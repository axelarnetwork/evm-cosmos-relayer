import { GMPListenerClient, AxelarClient, EvmClient } from './clients';
import { config } from './config';
import hapi, { Request } from '@hapi/hapi';
import Joi from 'joi';
import { Subject, filter } from 'rxjs';
import { EvmEvent, IBCEvent, IBCPacketEvent, PaginationParams } from './types';
import { ContractCallWithTokenEventObject } from './types/contracts/IAxelarGatewayAbi';
import {
  getBatchCommandIdFromSignTx,
  getPacketSequenceFromExecuteTx,
} from './utils/parseUtils';
import { prisma } from './clients';
import { ContractCallApprovedWithMintEventObject } from './types/contracts/IAxelarGateway';
import {
  handleCompleteGMPCosmos,
  handleReceiveGMPApproveEvm,
  handleReceiveGMPCosmos,
  handleReceiveGMPEvm,
} from './handler';

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
  const evm = config.evm['ganache-0'];
  const observedDestinationChains = [config.cosmos.demo.chainId];
  const listener = new GMPListenerClient(evm.rpcUrl, evm.gateway);
  const vxClient = await AxelarClient.init(config.cosmos.devnet);
  const demoClient = await AxelarClient.init(config.cosmos.demo);
  const evmClient = new EvmClient(config.evm['ganache-0']);

  // Create an event subject for ContractCallWithTokenListenerEvent
  const evmWithTokenObservable = new Subject<
    EvmEvent<ContractCallWithTokenEventObject>
  >();
  const evmApproveWithTokenObservable = new Subject<
    EvmEvent<ContractCallApprovedWithMintEventObject>
  >();
  const cosmosWithTokenObservable = new Subject<
    IBCEvent<ContractCallWithTokenEventObject>
  >();
  const cosmosCompleteObservable = new Subject<IBCPacketEvent>();

  // Filter events by destination chain
  // Subscribe to the gmp event from evm to cosmos.
  evmWithTokenObservable
    .pipe(
      filter((event) =>
        observedDestinationChains.includes(event.args.destinationChain)
      )
    )
    .subscribe(async (event) => {
      handleReceiveGMPEvm(vxClient, event);
    });

  // Subscribe to the gmp event from cosmos to evm when it's already approved.
  evmApproveWithTokenObservable.subscribe(async (event) => {
    handleReceiveGMPApproveEvm(evmClient, event);
  });

  cosmosWithTokenObservable.subscribe(async (event) => {
    handleReceiveGMPCosmos(vxClient, evmClient, event);
  });

  cosmosCompleteObservable.subscribe(async (event) => {
    handleCompleteGMPCosmos(demoClient, event);
  });

  // Pass the subject to the event listener, so that the listener can push events to the subject
  listener.listenEVM(evmWithTokenObservable, evmApproveWithTokenObservable);
  vxClient.listenForCosmosGMP(cosmosWithTokenObservable);
  vxClient.listenForIBCComplete(cosmosCompleteObservable);

  await initServer();
}

console.log('Starting relayer server...');
main();
