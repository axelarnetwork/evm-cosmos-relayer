import { PrismaClientInitializationError } from '@prisma/client/runtime';
import { prisma } from '..';
import { logger } from '../logger';

export async function handleAnyError(tag: string, e: any) {
  // handle prisma error
  if (e instanceof PrismaClientInitializationError) {
    logger.error(`[${tag}]: ${e.message}`);

    // disconnect the db, so the prisma client can be re-used when the db is back up
    await prisma.$disconnect();
  }
}
