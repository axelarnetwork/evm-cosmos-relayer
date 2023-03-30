import { PrismaClientInitializationError } from '@prisma/client/runtime';
import { DatabaseClient } from '..';
import { logger } from '../logger';

export async function handleAnyError(db: DatabaseClient, tag: string, e: any) {
  // handle prisma error
  if (e instanceof PrismaClientInitializationError) {
    // disconnect the db, so the prisma client can be re-used when the db is back up
    await db.disconnect();
  }
  logger.error(`[${tag}]: ${e.message}`);
}
