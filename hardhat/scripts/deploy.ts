import { ethers, network } from 'hardhat';
import { avalanche, evm } from '../constant';

function getNetworkConfig(networkName: string) {
  if (networkName === 'avalanche') {
    return avalanche;
  } else if (networkName === 'goerli') {
    return evm;
  } else {
    throw new Error('Network not supported');
  }
}

async function deployCallContractWithToken() {
  console.log('Deploy on network', network.name);
  const networkConfig = getNetworkConfig(network.name);

  const CallContractWithToken = await ethers.getContractFactory(
    'CallContractWithToken'
  );
  const callContractWithToken = await CallContractWithToken.deploy(
    networkConfig.gateway,
    networkConfig.gasService
  );
  await callContractWithToken.deployed();

  console.log(
    'CallContractWithToken deployed to:',
    callContractWithToken.address
  );
}

deployCallContractWithToken().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
