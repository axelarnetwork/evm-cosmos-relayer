import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import './tasks/multiSend';
import './tasks/balance';
import './tasks/osmosisTest';
import { evm, avax } from './constant';
import { privateKey } from './secret.json';

const config: HardhatUserConfig = {
  solidity: '0.8.9',
  defaultNetwork: 'avalanche',
  networks: {
    goerli: {
      chainId: 5,
      gasMultiplier: 2,
      url: evm.rpcUrl,
      accounts: [privateKey],
    },
    avalanche: {
      chainId: 43113,
      gasMultiplier: 2,
      url: avax.rpcUrl,
      accounts: [privateKey],
    },
  },
};

export default config;
