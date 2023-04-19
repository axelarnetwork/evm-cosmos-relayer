import testnetAxelar from '../../data/testnet/axelar.json';
import testnetCosmos from '../../data/testnet/cosmos.json';
import testnetEvm from '../../data/testnet/evm.json';
import devnetAxelar from '../../data/devnet/axelar.json';
import devnetCosmos from '../../data/devnet/cosmos.json';
import devnetEvm from '../../data/devnet/evm.json';
import mainnetAxelar from '../../data/mainnet/axelar.json';
import mainnetEvm from '../../data/mainnet/evm.json';
import mainnetCosmos from '../../data/mainnet/cosmos.json';
import { env } from '.';
import { CosmosNetworkConfig, EvmNetworkConfig } from './types';

function getCosmosChains() {
  if (env.CHAIN_ENV === 'devnet') {
    return devnetCosmos;
  } else if (env.CHAIN_ENV === 'mainnet') {
    return mainnetCosmos;
  }
  return testnetCosmos;
}

function getAxelarChain() {
  if (env.CHAIN_ENV === 'devnet') {
    return devnetAxelar;
  } else if (env.CHAIN_ENV === 'mainnet') {
    return mainnetAxelar;
  }
  return testnetAxelar;
}

function getEvmChains() {
  if (env.CHAIN_ENV === 'devnet') {
    return devnetEvm;
  } else if (env.CHAIN_ENV === 'mainnet') {
    return mainnetEvm;
  }
  return testnetEvm;
}

const cosmos = getCosmosChains();
const axelar = getAxelarChain();
const evm = getEvmChains();

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
