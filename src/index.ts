import { GMPListenerClient, AxelarClient } from "./clients";
import { config } from "./config";
import hapi from "@hapi/hapi";
export * from "./config";
export * from "./clients";

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
  const listener = new GMPListenerClient(evm.rpcUrl, evm.gateway);

  listener.listenEVM();

  await initServer();
}

main();
