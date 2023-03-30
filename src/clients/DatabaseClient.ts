import { PrismaClient } from '@prisma/client';
import {
  ContractCallSubmitted,
  ContractCallWithTokenSubmitted,
  EvmEvent,
  IBCEvent,
  Status,
} from '../types';
import {
  ContractCallWithTokenEventObject,
  ContractCallEventObject,
  ContractCallApprovedEventObject,
  ContractCallApprovedWithMintEventObject,
} from '../types/contracts/IAxelarGateway';
import { logger } from '../logger';
import { Transaction, ethers } from 'ethers';

export class DatabaseClient {
  prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  createCosmosContractCallEvent(event: IBCEvent<ContractCallSubmitted>) {
    return this.prisma.relayData.create({
      data: {
        id: `${event.args.messageId}`,
        from: event.args.sourceChain,
        to: event.args.destinationChain,
        status: Status.PENDING,
        callContract: {
          create: {
            payload: event.args.payload,
            payloadHash: event.args.payloadHash,
            contractAddress: event.args.contractAddress,
            sourceAddress: event.args.sender,
          },
        },
      },
    });
  }

  createCosmosContractCallWithTokenEvent(
    event: IBCEvent<ContractCallWithTokenSubmitted>
  ) {
    return this.prisma.relayData.create({
      data: {
        id: `${event.args.messageId}`,
        from: event.args.sourceChain,
        to: event.args.destinationChain,
        status: Status.PENDING,
        callContractWithToken: {
          create: {
            payload: event.args.payload,
            payloadHash: event.args.payloadHash,
            contractAddress: event.args.contractAddress,
            sourceAddress: event.args.sender,
            amount: event.args.amount.toString(),
            symbol: event.args.symbol,
          },
        },
      },
    });
  }

  createEvmCallContractEvent(event: EvmEvent<ContractCallEventObject>) {
    const id = `${event.hash}-${event.logIndex}`;
    return this.prisma.relayData.create({
      data: {
        id,
        from: event.sourceChain,
        to: event.destinationChain,
        callContract: {
          create: {
            payload: event.args.payload,
            payloadHash: event.args.payloadHash,
            contractAddress: event.args.destinationContractAddress,
            sourceAddress: event.args.sender,
          },
        },
      },
    });
  }

  createEvmCallContractWithTokenEvent(
    event: EvmEvent<ContractCallWithTokenEventObject>
  ) {
    const id = `${event.hash}-${event.logIndex}`;
    return this.prisma.relayData.create({
      data: {
        id,
        from: event.sourceChain,
        to: event.destinationChain,
        callContractWithToken: {
          create: {
            payload: event.args.payload,
            payloadHash: event.args.payloadHash,
            contractAddress: event.args.destinationContractAddress,
            sourceAddress: event.args.sender,
            amount: event.args.amount.toString(),
            symbol: event.args.symbol,
          },
        },
      },
    });
  }

  async updateCosmosToEvmEvent(
    event: IBCEvent<ContractCallSubmitted | ContractCallWithTokenSubmitted>,
    tx?: ethers.providers.TransactionReceipt
  ) {
    if (!tx) return;

    const record = await this.prisma.relayData.update({
      where: {
        id: event.args.messageId,
      },
      data: {
        executeHash: tx.transactionHash,
        status: Status.APPROVED,
      },
    });

    logger.info(`[handleCosmosToEvmEvent] DBUpdate: ${JSON.stringify(record)}`);
  }

  async findRelayDataById(
    id: string,
    options?: { callContract?: boolean; callContractWithToken?: boolean }
  ) {
    const callContract = options?.callContract || true;
    const callContractWithToken = options?.callContractWithToken || true;
    return this.prisma.relayData.findFirst({
      where: {
        id,
      },
      include: {
        callContract,
        callContractWithToken,
      },
    });
  }

  async findCosmosToEvmCallContractApproved(
    event: EvmEvent<ContractCallApprovedEventObject>
  ) {
    const { contractAddress, sourceAddress, payloadHash } = event.args;

    const datas = await this.prisma.relayData.findMany({
      where: {
        callContract: {
          payloadHash,
          sourceAddress,
          contractAddress,
        },
        status: Status.APPROVED,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        callContract: {
          select: {
            payload: true,
          },
        },
        id: true,
      },
    });

    return datas.map((data) => ({
      id: data.id,
      payload: data.callContract?.payload,
    }));
  }

  async findCosmosToEvmCallContractWithTokenApproved(
    event: EvmEvent<ContractCallApprovedWithMintEventObject>
  ) {
    const { amount, contractAddress, sourceAddress, payloadHash } = event.args;

    const datas = await this.prisma.relayData.findMany({
      where: {
        callContractWithToken: {
          payloadHash: payloadHash,
          sourceAddress: sourceAddress,
          contractAddress: contractAddress,
          amount: amount.toString(),
        },
        status: Status.APPROVED,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        callContractWithToken: {
          select: {
            payload: true,
          },
        },
        id: true,
      },
    });

    return datas.map((data) => ({
      id: data.id,
      payload: data.callContractWithToken?.payload,
    }));
  }

  async updateEventStatus(id: string, status: Status) {
    const executeDb = await this.prisma.relayData.update({
      where: {
        id,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
    logger.info(`[DBUpdate] ${JSON.stringify(executeDb)}`);
  }

  getPrismaClient() {
    return this.prisma;
  }

  connect() {
    return this.prisma.$connect();
  }

  disconnect() {
    return this.prisma.$disconnect();
  }
}
