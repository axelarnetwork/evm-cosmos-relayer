import { GMPListenerClient, AxelarClient } from "./clients";
import { config } from "./config";
import hapi from "@hapi/hapi";
import { Subject, filter } from "rxjs";
import { ContractCallWithTokenListenerEvent } from "./types/filteredEvents";
import { getPacketSequenceFromExecuteTx } from "./utils/parseUtils";
import WebSocket from "isomorphic-ws";
import ReconnectingWebSocket from 'reconnecting-websocket';
import { PrismaClient } from '@prisma/client'

const initServer = async () => {
  const server = hapi.server({
    port: 3000,
    host: "localhost",
  });

  // TODO: add the api routes here for a list of relayed txs and more info about relayer.

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
  const prisma = new PrismaClient()

  // Subscribe to the observable to execute txs on Axelar for relaying to Cosmos
  evmToCosmosObservable.subscribe(async (event) => {
    // Sent a confirm tx to devnet-vx
    const confirmTx = await vxClient.confirmEvmTx(
      config.evm["ganache-0"].name,
      event.hash
    );
    console.log("\nConfirmed:", confirmTx.transactionHash);

    console.log("Wait for confirmation... (5s)");
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
    console.log("\nExecuted:", executeTx.transactionHash);
    const packetSeq = getPacketSequenceFromExecuteTx(executeTx);
    console.log("PacketSeq", packetSeq)
    const entry = await prisma.relay_data.create({
      data: {
        seq: packetSeq,
        txhash: `${event.hash}-${event.logIndex}`,
      }
    })
    console.log("Saved to db", entry);
  });

  // Debugging Purpose: Logging balance update
  const options = {
    WebSocket, // custom WebSocket constructor
    connectionTimeout: 1000,
    maxRetries: 10,
};
  const client = new ReconnectingWebSocket(config.cosmos.devnet.ws, [], options);
  client.addEventListener('open',  () => {
    console.log('ws connected!')
    const topic = `tm.event='Tx' AND acknowledge_packet.packet_dst_port='transfer'`
    client.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'subscribe',
      params: [topic]
    }))
    client.addEventListener('message', (ev: MessageEvent<any>) => {
      // convert buffer to json
      console.log(ev.data)
      const event = JSON.parse(ev.data.toString())

      // check if the event topic is matched
      if(event.result.query !== topic) return;

      const packetSequence = parseInt(event.result.events['acknowledge_packet.packet_sequence'][0])

      console.log("Received balance update for seq:", packetSequence)
      demoClient.getBalance(
        recipientAddress,
        "ibc/52E89E856228AD91E1ADE256E9EDEA4F2E147A426E14F71BE7737EB43CA2FCC5"
      ).then(balance => {
        console.log("Balance:", balance);
      })
    })
  })

  await initServer();
}

main();
