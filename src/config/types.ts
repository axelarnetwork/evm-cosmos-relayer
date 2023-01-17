export interface CosmosNetworkConfig {
  chainId: string;
  rpcUrl: string;
  lcdUrl: string;
  ws: string;
  denom: string;
  mnemonic: string;
}

export interface EvmNetworkConfig {
  name: string,
  rpcUrl: string,
  gateway: string,
  privateKey: string
}
