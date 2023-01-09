import { PrismaClient } from "@prisma/client";

export * from "./AxelarClient";
export * from "./GMPListenerClient";
export const prisma = new PrismaClient();
