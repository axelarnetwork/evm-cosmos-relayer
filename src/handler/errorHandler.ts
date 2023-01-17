import { PrismaClientInitializationError } from '@prisma/client/runtime';
import { prisma } from '..';

export async function handleAnyError(tag: string, e: any) {
  // handle prisma error
  if (e instanceof PrismaClientInitializationError) {
    console.error(tag, e.message);

    // disconnect the db, so the prisma client can be re-used when the db is back up
    await prisma.$disconnect();
  }
}
