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

const demo: CosmosNetworkConfig = {
  mnemonic: env.AXELAR_MNEMONIC,
  chainId: 'demo-chain',
  denom: 'udemo',
  rpcUrl:
    'http://a1b287720a05545eb8e2f6c769a1af6b-1437958231.us-east-2.elb.amazonaws.com:26657',
  lcdUrl:
    'http://a1b287720a05545eb8e2f6c769a1af6b-1437958231.us-east-2.elb.amazonaws.com:1317',
  ws: 'ws://a1b287720a05545eb8e2f6c769a1af6b-1437958231.us-east-2.elb.amazonaws.com:26657/websocket',
};

const devnet: CosmosNetworkConfig = {
  mnemonic: env.AXELAR_MNEMONIC,
  chainId: 'devnet-wk',
  denom: 'uwk',
  rpcUrl:
    'http://afc5d4a439e4a456bafe34c2d9cd955b-182827533.us-east-2.elb.amazonaws.com:26657',
  lcdUrl:
    'http://afc5d4a439e4a456bafe34c2d9cd955b-182827533.us-east-2.elb.amazonaws.com:1317',
  ws: 'ws://afc5d4a439e4a456bafe34c2d9cd955b-182827533.us-east-2.elb.amazonaws.com:26657/websocket',
};

const ganache0: EvmNetworkConfig = {
  name: 'ganache-0',
  privateKey: env.EVM_PRIVATE_KEY,
  rpcUrl:
    'http://a5c6803b39cd942c3b9daee2847e24fa-1977123350.us-east-2.elb.amazonaws.com:7545',
  gateway: '0xE720c5C38028Ca08DA47E179162Eca2DD255B6eC',
};

export const config = {
  cosmos: {
    demo,
    devnet,
  },
  evm: {
    'ganache-0': ganache0,
  },
};
