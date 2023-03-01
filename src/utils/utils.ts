import { config } from '../config';
import { logger } from '../logger';

// sleep
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const removeQuote = (str: string) => {
  return str.replace(/['"]+/g, '');
};

export const decodeBase64 = (str: string) => {
  return Buffer.from(str, 'base64').toString('hex');
};

export const getChainNameFromChainId = (chainId: number) => {
  const keys = Object.keys(config.evm) as Array<keyof typeof config.evm>;
  const key = keys.find((key) => config.evm[key].chainId === chainId);
  if (!key) return;
  return config.evm[key];
};
