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

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

async function main() {
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

  // Subscribe to the observable to execute txs on Axelar for relaying to Cosmos
  const client = await AxelarClient.init();
  evmToCosmosObservable.subscribe(async (event) => {
    // Confirm tx
    const confirmTx = await client.confirmEvmTx("ganache-0", event.hash);
    console.log("Confirm tx: ", confirmTx.transactionHash);

    console.log("Wait for 20 seconds...");
    await sleep(20000);
    const executeTx = await client.executeGeneralMessageWithToken(
      event.args.destinationChain,
      event.logIndex,
      event.hash,
      event.args.payload
    );
    console.log("Execute tx:", executeTx.transactionHash);

    // Check recipient balance
    await sleep(3000);
    const client2 = await AxelarClient.init(config.cosmos.demo);
    const balance = await client2.getBalance(
      client2.sdk.signerAddress,
      "uusda"
    );
    console.log("Balance: ", balance);
  });

  await initServer();
}

main();
