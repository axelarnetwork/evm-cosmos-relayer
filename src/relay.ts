import { GMPListenerClient, AxelarClient } from "./clients";
import { config } from "./config";
import hapi from "@hapi/hapi";
import { Subject, filter } from "rxjs";
import { ContractCallWithTokenListenerEvent } from "./types/filteredEvents";

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

  const subject = new Subject<ContractCallWithTokenListenerEvent>();

  // Event publisher
  listener.listenEVM(subject);

  // Event consumer, observe only events with destinationChain in observedDestinationChains
  const evmToCosmosObservable = subject.pipe(
    filter((event) =>
      observedDestinationChains.includes(event.args.destinationChain)
    )
  );

  // Logging
  evmToCosmosObservable.subscribe((event) => {
    console.log("Received event:", event);
  });

  const client = await AxelarClient.init();
  evmToCosmosObservable.subscribe(async (event) => {
    const confirmTx = await client.confirmEvmTx("ganache-0", event.hash);
    console.log("Confirm tx: ", confirmTx.transactionHash);

    const executeTx = await client.executeGeneralMessageWithToken(
      event.args.destinationChain,
      event.logIndex,
      event.hash,
      event.args.payload
    );
    console.log("Execute tx:", executeTx.transactionHash);

    // Check recipient balance
    const client2 = await AxelarClient.init(config.cosmos.demo);
    const balance = await client2.getBalance(
      client2.sdk.signerAddress,
      "ibc/52E89E856228AD91E1ADE256E9EDEA4F2E147A426E14F71BE7737EB43CA2FCC5"
    );
    console.log("Balance: ", balance);
  });

  await initServer();
}

main();
