import 'dotenv/config';
import { CosmosNetworkConfig, EvmNetworkConfig } from './types';

export const env = {
  DEV: process.env.DEV || false,
  AXELAR_MNEMONIC: process.env.AXELAR_MNEMONIC || '',
  EVM_PRIVATE_KEY: process.env.EVM_PRIVATE_KEY || '',
  MAX_RETRY: parseInt(process.env.MAX_RETRY || '5'),
  RETRY_DELAY: parseInt(process.env.RETRY_DELAY || '3000'),
  HERMES_METRIC_URL:
    process.env.HERMES_METRIC_URL || 'http://localhost:3001/metrics',
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/relayer',
  PORT: process.env.PORT || 3000,
  DD_API_KEY: process.env.DD_API_KEY || '',
};

const axelarTestnet: CosmosNetworkConfig = {
  mnemonic: env.AXELAR_MNEMONIC,
  chainId: 'axelar-testnet',
  denom: 'uaxl',
  rpcUrl: 'https://rpc-axelar-testnet.imperator.co:443',
  lcdUrl: 'https://lcd-axelar-testnet.imperator.co',
  ws: 'ws://rpc-axelar-testnet.imperator.co/wss',
};

const osmosis: CosmosNetworkConfig = {
  mnemonic: env.AXELAR_MNEMONIC,
  chainId: 'osmosis-5',
  denom: 'uosmo',
  rpcUrl: 'https://rpc.testnet.osmosis.zone:443',
  lcdUrl: 'https://lcd-test.osmosis.zone',
  ws: 'wss://rpc.testnet.osmosis.zone/websocket',
};

const goerli: EvmNetworkConfig = {
  name: 'goerli',
  privateKey: env.EVM_PRIVATE_KEY,
  rpcUrl: 'https://goerli.infura.io/v3/10de1265f1234c93acfec19ca8f4afd7',
  gateway: '0xe432150cce91c13a887f7D836923d5597adD8E31',
};

export const config = {
  cosmos: {
    testnet: axelarTestnet,
    osmosis,
  },
  evm: {
    goerli,
  },
};
