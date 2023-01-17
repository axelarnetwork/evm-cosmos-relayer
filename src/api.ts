import hapi, { Request } from '@hapi/hapi';
import { env, prisma } from '..';
import Joi from 'joi';
import fetch from 'node-fetch';
import { PaginationParams } from './types';
import { PrismaClient } from '@prisma/client';
import { apiLogger, logger } from './logger';

export const initServer = async () => {
  const server = hapi.server({
    port: 3000,
    host: 'localhost',
  });

  server.route({
    method: 'GET',
    path: '/tx.get',
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
      validate: {
        payload: Joi.object({
          page: Joi.number().integer().min(0).default(0),
          limit: Joi.number().integer().min(1).max(100).default(10),
          include: {
            callContractWithToken: Joi.boolean().default(false),
          },
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
      const { page, limit, orderBy, completed, include } = payload;

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
