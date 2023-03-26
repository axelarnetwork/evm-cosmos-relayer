import { ethers } from 'hardhat';
import { avalanche, evm } from '../constant';

async function main() {
  const MultiSend = await ethers.getContractFactory('MultiSend');
  const multiSend = await MultiSend.deploy(
    evm.gateway,
    ethers.constants.AddressZero
  );
  await multiSend.deployed();

  console.log('MultiSend deployed to:', multiSend.address);
}

async function deployOsmosis() {
  const OsmosisTest = await ethers.getContractFactory('OsmosisTest');
  const osmosisTest = await OsmosisTest.deploy(
    avalanche.gateway,
    avalanche.gasService
  );
  await osmosisTest.deployed();

  console.log('OsmosisTest deployed to:', osmosisTest.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
deployOsmosis().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
