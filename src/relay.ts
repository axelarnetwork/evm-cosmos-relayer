import { GMPListenerClient, AxelarClient } from "./clients";
import { config } from "./config";
import hapi from "@hapi/hapi";
import { Subject, filter } from "rxjs";
import { ContractCallWithTokenListenerEvent } from "./types/filteredEvents";
import { sleep } from "./utils/utils";

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

  // Subscribe to the observable to execute txs on Axelar for relaying to Cosmos
  evmToCosmosObservable.subscribe(async (event) => {
    // Sent a confirm tx to devnet-vx
    const confirmTx = await vxClient.confirmEvmTx("ganache-0", event.hash);
    console.log("\nConfirmed:", confirmTx.transactionHash);

    // TODO: use a better way to wait for confirmation
    console.log("Wait for confirmation... (10s)");
    await sleep(10000);

    // Sent an execute tx to devnet-vx
    const executeTx = await vxClient.executeGeneralMessageWithToken(
      event.args.destinationChain,
      event.logIndex,
      event.hash,
      event.args.payload
    );
    console.log("\nExecuted:", executeTx.transactionHash);

    // Check recipient balance
    console.log("Wait for balance to be updated... (5s)");
    await sleep(5000);
    const balance = await demoClient.getBalance(
      recipientAddress,
      "ibc/52E89E856228AD91E1ADE256E9EDEA4F2E147A426E14F71BE7737EB43CA2FCC5"
    );
    console.log("Balance:", balance);
  });

  await initServer();
}

main();
