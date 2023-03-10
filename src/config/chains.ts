import axelar from '../../data/axelar.json';
import cosmos from '../../data/cosmos.json';
import evm from '../../data/evm.json';
import { env } from '.';
import { CosmosNetworkConfig, EvmNetworkConfig } from './types';

export const cosmosChains: CosmosNetworkConfig[] = cosmos.map((chain) => ({
  ...chain,
  mnemonic: env.AXELAR_MNEMONIC,
}));

export const axelarChain: CosmosNetworkConfig = {
  ...axelar,
  mnemonic: env.AXELAR_MNEMONIC,
};

export const evmChains: EvmNetworkConfig[] = evm.map((chain) => ({
  ...chain,
  privateKey: env.EVM_PRIVATE_KEY,
}));
