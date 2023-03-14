import { task } from 'hardhat/config';
import { cosmos, ganache } from '../constant';

task('multisend', 'Send GMP tx to cosmos')
  .addPositionalParam('recipient', 'Recipient address')
  .addPositionalParam('amount', 'Amount')
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();
    const { recipient, amount } = taskArgs;
    const multisendAddress = '0x813aDfA0B1Ff21785533f3c3585418e710023FD9';

    const multiSend = await ethers.getContractAt(
      'MultiSend',
      multisendAddress,
      deployer
    );

    const destinationChain = hre.network.name === 'ganache0' ? "osmo-test-4" : "osmosis-5";
    const destAddress =
      'osmo1t20627jap26tak0nyrjzq0pajks36atf6rs475wvnpprr4pd2kysaxz2nj';
    const receivers = [recipient, recipient];
    const symbol = 'axlUSDA';

    const gateway = new ethers.Contract(
      ganache.gateway,
      [
        'function tokenAddresses(string memory symbol) external view returns (address)',
      ],
      deployer
    );
    const usdaAddress = await gateway.tokenAddresses(symbol);

    const erc20 = new ethers.Contract(
      usdaAddress,
      ['function approve(address spender, uint256 amount)'],
      deployer
    );
    await erc20.approve(multisendAddress, amount).then((tx: any) => tx.wait());
    console.log('Approved');

    const tx = await multiSend.multiSend(
      destinationChain,
      destAddress,
      receivers,
      symbol,
      amount
    );

    console.log('Sent', tx.hash);
  });
