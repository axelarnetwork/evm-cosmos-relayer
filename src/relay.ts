import { GMPListenerClient, AxelarClient, EvmClient } from './clients';
import { config } from './config';
import { Subject, filter } from 'rxjs';
import { EvmEvent, IBCEvent, IBCPacketEvent } from './types';
import { ContractCallWithTokenEventObject } from './types/contracts/IAxelarGatewayAbi';
import { ContractCallApprovedWithMintEventObject } from './types/contracts/IAxelarGateway';
import {
  handleCompleteGMPCosmos,
  handleReceiveGMPApproveEvm,
  handleReceiveGMPCosmos,
  handleReceiveGMPEvm,
} from './handler';
import { initServer } from './api';

async function main() {
  const evm = config.evm['ganache-0'];
  const observedDestinationChains = [config.cosmos.demo.chainId];
  const listener = new GMPListenerClient(evm.rpcUrl, evm.gateway);
  const evmClient = new EvmClient(config.evm['ganache-0']);
  const vxClient = await AxelarClient.init(config.cosmos.devnet);
  const demoClient = await AxelarClient.init(config.cosmos.demo);

  // Create an event subject for ContractCallWithTokenListenerEvent
  const evmWithTokenObservable = new Subject<
    EvmEvent<ContractCallWithTokenEventObject>
  >();
  const evmApproveWithTokenObservable = new Subject<
    EvmEvent<ContractCallApprovedWithMintEventObject>
  >();
  const cosmosWithTokenObservable = new Subject<
    IBCEvent<ContractCallWithTokenEventObject>
  >();
  const cosmosCompleteObservable = new Subject<IBCPacketEvent>();

  // Filter events by destination chain
  // Subscribe to the gmp event from evm to cosmos.
  evmWithTokenObservable
    .pipe(
      filter((event) =>
        observedDestinationChains.includes(event.args.destinationChain)
      )
    )
    .subscribe((event) => handleReceiveGMPEvm(vxClient, event));

  // Subscribe to the gmp event from cosmos to evm when it's already approved.
  evmApproveWithTokenObservable.subscribe((event) =>
    handleReceiveGMPApproveEvm(evmClient, event)
  );

  cosmosWithTokenObservable.subscribe((event) =>
    handleReceiveGMPCosmos(vxClient, evmClient, event)
  );

  cosmosCompleteObservable.subscribe((event) =>
    handleCompleteGMPCosmos(demoClient, event)
  );

  // Pass the subject to the event listener, so that the listener can push events to the subject
  listener.listenEVM(evmWithTokenObservable, evmApproveWithTokenObservable);
  vxClient.listenForCosmosGMP(cosmosWithTokenObservable);
  vxClient.listenForIBCComplete(cosmosCompleteObservable);
}

console.log('Starting relayer server...');
initServer();
main();
