import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import './tasks/multiSend';
import './tasks/balance';
import './tasks/osmosisTest';
import { evm, ganache } from './constant';
import { privateKey } from './secret.json';

const config: HardhatUserConfig = {
  solidity: '0.8.9',
  defaultNetwork: 'ganache0',
  networks: {
    ganache0: {
      chainId: 1337,
      gasMultiplier: 2,
      url: ganache.rpcUrl,
      accounts: [privateKey],
    },
    goerli: {
      chainId: 5,
      gasMultiplier: 2,
      url: evm.rpcUrl,
      accounts: [privateKey],
    },
  },
};

export default config;
