import hapi, { Request } from '@hapi/hapi';
import { env, prisma } from './index';
import Joi from 'joi';
import fetch from 'node-fetch';
import { PaginationParams } from './types';
import { PrismaClient } from '@prisma/client';
import { apiLogger } from './logger';
import Inert from '@hapi/inert';
import Vision from '@hapi/vision';
import HapiSwagger from 'hapi-swagger';

export const initServer = async () => {
  const server = hapi.server({
    port: 3000,
    host: 'localhost',
  });

  const swaggerOptions = {
    info: {
      title: 'CosmosGMP Relayer API Documentation',
      version: '1.0.0',
    },
  };
  const plugins: Array<hapi.ServerRegisterPluginObject<any>> = [
    {
      plugin: Inert,
    },
    {
      plugin: Vision,
    },
    {
      plugin: HapiSwagger,
      options: swaggerOptions,
    },
  ];

  await server.register(plugins);

  server.route({
    method: 'GET',
    path: '/tx.get',
    options: {
      description: 'Get a transaction by txHash and logIndex',
      notes:
        'Returns the transaction detail of given txHash and logIndex. status:0 = pending, status:1 = approved, status:2 = completed, status:3 = failed',
      tags: ['api'],
      validate: {
        query: Joi.object({
          txHash: Joi.string()
            .required()
            .description('A transaction hash of source tx.'),
          logIndex: Joi.number()
            .required()
            .default(0)
            .description(
              'A log index of the CallContractWithToken event (from cosmos, the logIndex is 0)'
            ),
        }),
      },
    },
    handler: async (request) => {
      const { txHash, logIndex } = request.query;
      const data = await prisma.relayData.findFirst({
        where: {
          id: `${txHash}-${logIndex}`,
        },
        include: {
          callContractWithToken: true,
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
    path: '/tx.all',
    options: {
      auth: false,
      description: 'Get all transactions',
      notes: 'Returns a paginated of transactions',
      tags: ['api'],
      validate: {
        payload: Joi.object({
          page: Joi.number().integer().min(0).default(0),
          limit: Joi.number().integer().min(1).max(100).default(10),
          include: {
            callContractWithToken: Joi.boolean().default(false),
          },
          orderBy: Joi.object()
            .keys({
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
      const { page, limit, orderBy, completed, include } = payload;
      console.log(payload);

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
        include,
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

  // status endpoint
  server.route({
    method: 'GET',
    path: '/status',
    options: {
      auth: false,
      description: 'Returns an object with the status of each services',
      notes: 'Check the status of dependant services (hermes, postgresdb, api)',
      tags: ['api'],
    },
    handler: async () => {
      const hermesAlive = await fetch(env.HERMES_METRIC_URL)
        .then((res) => res.ok)
        .catch(() => false);

      const dbAlive = await new PrismaClient()
        .$connect()
        .then(() => true)
        .catch(() => false);

      return {
        relayer: true,
        hermes: hermesAlive,
        db: dbAlive,
      };
    },
  });

  await server.start();
  apiLogger.info(`Server running on ${server.info.uri}`);
};
