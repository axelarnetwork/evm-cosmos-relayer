import testnetAxelar from '../../data/testnet/axelar.json';
import testnetCosmos from '../../data/testnet/cosmos.json';
import testnetEvm from '../../data/testnet/evm.json';
import devnetAxelar from '../../data/devnet/axelar.json';
import devnetCosmos from '../../data/devnet/cosmos.json';
import devnetEvm from '../../data/devnet/evm.json';
import { env } from '.';
import { CosmosNetworkConfig, EvmNetworkConfig } from './types';

const cosmos = env.CHAIN_ENV === 'devnet' ? devnetCosmos : testnetCosmos;
const axelar = env.CHAIN_ENV === 'devnet' ? devnetAxelar : testnetAxelar;
const evm = env.CHAIN_ENV === 'devnet' ? devnetEvm : testnetEvm;

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
