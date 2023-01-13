import { PrismaClient } from "@prisma/client";

export * from "./AxelarClient";
export * from "./GMPListenerClient";
export * from './SigningClient'
export * from './IbcClient'
export * from './EvmClient'
export const prisma = new PrismaClient();
