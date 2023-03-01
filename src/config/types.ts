export interface CosmosNetworkConfig {
  chainId: string;
  rpcUrl: string;
  lcdUrl: string;
  ws: string;
  denom: string;
  mnemonic: string;
  gasPrice: string;
}

export interface EvmNetworkConfig {
  id: string;
  chainId: number;
  name: string;
  rpcUrl: string;
  gateway: string;
  privateKey: string;
}
