import { PrismaClient } from "@prisma/client";

export * from "./AxelarClient";
export * from "./GMPListenerClient";
export * from './SigningClient'
export const prisma = new PrismaClient();
