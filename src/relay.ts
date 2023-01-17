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

  evmWithTokenObservable
    .pipe(
      filter((event) =>
        observedDestinationChains.includes(event.args.destinationChain)
      )
    )
    .subscribe((event) => handleReceiveGMPEvm(vxClient, event));

  evmApproveWithTokenObservable.subscribe((event) =>
    handleReceiveGMPApproveEvm(evmClient, event)
  );

  cosmosWithTokenObservable.subscribe((event) =>
    handleReceiveGMPCosmos(vxClient, evmClient, event)
  );

  cosmosCompleteObservable.subscribe((event) =>
    handleCompleteGMPCosmos(demoClient, event)
  );

  // listen for events on cosmos and evm
  listener.listenEVM(evmWithTokenObservable, evmApproveWithTokenObservable);
  vxClient.listenForCosmosGMP(cosmosWithTokenObservable);
  vxClient.listenForIBCComplete(cosmosCompleteObservable);
}

console.log('Starting relayer server...');
initServer();

// handle error globally
main().catch((e) => console.error(e));
