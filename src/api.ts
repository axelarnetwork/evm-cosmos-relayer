import hapi, { Request } from '@hapi/hapi';
import { prisma } from '..';
import Joi from 'joi';
import { PaginationParams } from './types';

export const initServer = async () => {
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
