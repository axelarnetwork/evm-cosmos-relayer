import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import './tasks/callContractWithToken';
import './tasks/balance';
import { evm, ganache } from './constant';
import { privateKey } from './secret.json';

const config: HardhatUserConfig = {
  solidity: '0.8.9',
  defaultNetwork: 'avalanche',
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
    avalanche: {
      chainId: 43113,
      gasMultiplier: 2,
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      accounts: [privateKey],
    },
  },
};

export default config;
