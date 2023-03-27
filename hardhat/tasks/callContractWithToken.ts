import { task } from 'hardhat/config';
import { avalanche, evm, osmosis } from '../constant';

function getNetworkConfig(networkName: string) {
  if (networkName === 'avalanche') {
    return avalanche;
  } else if (networkName === 'goerli') {
    return evm;
  } else {
    throw new Error('Network not supported');
  }
}

task('callContractWithToken', 'Send GMP tx from evm to osmosis')
  .addPositionalParam('amount', 'Amount')
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();
    const { amount } = taskArgs;
    const _amount = ethers.utils.parseUnits(amount, 6);

    // copy the contract address from the deployment
    const callContractWithTokenContractAddress =
      '0xcdde0A559D8ca85df403b5caa6df6F425F5D114C';
    const callContractWithToken = await ethers.getContractAt(
      'CallContractWithToken',
      callContractWithTokenContractAddress,
      deployer
    );

    const receiver = [
      'osmo139a8plum50nhyqvu42papdf6xa9s3nfqdn5lx3',
      'osmo1kux208ex604jh4l6js4sap4nuygqw6eakzu9ye',
    ];
    const destinationChain = osmosis.name;
    const destAddress = osmosis.callContractWithToken;
    const symbol = 'aUSDC';
    const gateway = new ethers.Contract(
      getNetworkConfig(hre.network.name).gateway,
      ['function tokenAddresses(string symbol) view returns (address)'],
      deployer
    );
    const usdcAddress = await gateway.tokenAddresses(symbol);
    console.log('usdcAddress', usdcAddress);

    const erc20 = new ethers.Contract(
      usdcAddress,
      [
        'function approve(address spender, uint256 amount)',
        'function allowance(address owner, address spender) view returns (uint256)',
      ],
      deployer
    );

    if (
      (
        await erc20.allowance(deployer.address, callContractWithToken.address)
      ).lt(_amount)
    ) {
      await erc20
        .approve(callContractWithToken.address, ethers.constants.MaxUint256)
        .then((tx: any) => tx.wait());
      console.log('Approved');
    } else {
      console.log('Already approved');
    }

    const tx = await callContractWithToken.multiSend(
      destinationChain,
      destAddress,
      receiver,
      symbol,
      _amount,
      {
        value: ethers.utils.parseEther('0.01'),
      }
    );

    console.log('Sent', tx.hash);
  });
