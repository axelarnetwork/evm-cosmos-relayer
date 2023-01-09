import { GMPListenerClient, AxelarClient } from "./clients";
import { config } from "./config";
import hapi, {Request} from "@hapi/hapi";
import Joi from "joi";
import { Subject, filter } from "rxjs";
import { ContractCallWithTokenListenerEvent, IBCPacketEvent, PaginationParams } from "./types";
import { getPacketSequenceFromExecuteTx } from "./utils/parseUtils";
import { prisma } from './clients'

const initServer = async () => {
  const server = hapi.server({
    port: 3000,
    host: "localhost",
  });

  server.route({
    method: "GET",
    path: "/relayTx",
    handler: async (request) => {
      const { txHash, logIndex } = request.query;
      const data = await prisma.relay_data.findFirst({
        where: {
          id: `${txHash}-${logIndex}`
        }
      })

      if(!data) {
        return {
          success: false,
          data: null,
          error: "No data found"
        }
      }

      return {
        success: true,
        payload: data
      }
    }
  });

  // get all relay data in pagination
  server.route({
    method: "POST",
    path: "/relayTx.all",
    options: {
      auth: false,
      validate: {
        payload: Joi.object({
          page: Joi.number().integer().min(0).default(0),
          limit: Joi.number().integer().min(1).max(100).default(10),
          orderBy: Joi.object().keys({
            created_at: Joi.string().valid('asc', 'desc').default('desc'),
            updated_at: Joi.string().valid('asc', 'desc').default('desc'),
          }).default({
            updated_at: 'desc'
          }),
          completed: Joi.boolean().default(true),
        }).options({ stripUnknown: true })
      }
    },
    handler: async (request: Request) => {
      const payload = request.payload as PaginationParams;
      const { page, limit, orderBy, completed } = payload;

      const filtering = completed ? {
        dst_channel_id: {
          not: null
        }
      } : {
        dst_channel_id: {
          equals: null
        }
      }

      const data = await prisma.relay_data.findMany({
        skip: page * limit,
        take: limit,
        orderBy,
        where: filtering
      })

      return {
        success: true,
        payload: {
          data,
          page,
          total: data.length,
        }
      }
    }});

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

async function main() {
  const recipientAddress = "axelar199km5vjuu6edyjlwx62wvmr6uqeghyz4rwmyvk";
  const evm = config.evm["ganache-0"];
  const observedDestinationChains = [config.cosmos.demo.chainId];
  const listener = new GMPListenerClient(evm.rpcUrl, evm.gateway);

  // Create an event subject for ContractCallWithTokenListenerEvent
  const subject = new Subject<ContractCallWithTokenListenerEvent>();

  // Pass the subject to the event listener, so that the listener can push events to the subject
  listener.listenEVM(subject);

  // Filter events by destination chain
  const evmToCosmosObservable = subject.pipe(
    filter((event) =>
      observedDestinationChains.includes(event.args.destinationChain)
    )
  );

  // Subscribe to the observable to log events
  evmToCosmosObservable.subscribe((event) => {
    console.log("Received event:", event);
  });

  const vxClient = await AxelarClient.init(config.cosmos.devnet);
  const demoClient = await AxelarClient.init(config.cosmos.demo);

  // Subscribe to the observable to execute txs on Axelar for relaying to Cosmos
  evmToCosmosObservable.subscribe(async (event) => {
    // Sent a confirm tx to devnet-vx
    const confirmTx = await vxClient.confirmEvmTx(
      config.evm["ganache-0"].name,
      event.hash
    );
    console.log("Confirmed:", confirmTx.transactionHash);
    await vxClient.pollUntilContractCallWithTokenConfirmed(
      config.evm["ganache-0"].name,
      `${event.hash}-${event.logIndex}`
    );

    // Sent an execute tx to devnet-vx
    const executeTx = await vxClient.executeGeneralMessageWithToken(
      event.args.destinationChain,
      event.logIndex,
      event.hash,
      event.args.payload
    );
    console.log("Executed:", executeTx.transactionHash);
    const packetSeq = getPacketSequenceFromExecuteTx(executeTx);

    // save data to db.
    await prisma.relay_data.create({
      data: {
        id: `${event.hash}-${event.logIndex}`,
        packet_sequence: packetSeq,
      }
    })
  });


  // Listen for IBC packet events
  const ibcSubject = new Subject<IBCPacketEvent>();

  vxClient.listenForIBCComplete(ibcSubject);

  ibcSubject.subscribe(async (event) => {
    await prisma.relay_data.update({
      where: {
        packet_sequence: event.sequence,
      },
      data: {
        amount: event.amount,
        denom: event.denom,
        ibc_hash: event.hash,
        updated_at: new Date(),
        src_channel_id: event.srcChannel,
        dst_channel_id: event.destChannel,
      }
    })

    if(process.env.DEV) {
      demoClient.getBalance(
        recipientAddress,
        "ibc/52E89E856228AD91E1ADE256E9EDEA4F2E147A426E14F71BE7737EB43CA2FCC5"
      ).then(balance => {
        console.log("Balance:", balance);
      })
    }
  })

  await initServer();
}

main();
