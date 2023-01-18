import { Wallet, ethers } from 'ethers';
import { EvmNetworkConfig } from '../config/types';
import {
  IAxelarGateway__factory,
  IAxelarGateway,
  IAxelarExecutable,
  IAxelarExecutable__factory,
} from '../types/contracts';
import { env } from '..';
import { sleep } from '../utils/utils';
import { logger } from '../logger';

export class EvmClient {
  private wallet: Wallet;
  private gateway: IAxelarGateway;
  private maxRetry: number;
  private retryDelay: number;

  constructor(
    chain: EvmNetworkConfig,
    _maxRetry = env.MAX_RETRY,
    _retryDelay = env.RETRY_DELAY
  ) {
    this.wallet = new Wallet(
      chain.privateKey,
      new ethers.providers.JsonRpcProvider(chain.rpcUrl)
    );
    this.gateway = IAxelarGateway__factory.connect(chain.gateway, this.wallet);
    this.maxRetry = _maxRetry;
    this.retryDelay = _retryDelay;
  }

  public execute(executeData: string) {
    return this.submitTx({
      to: this.gateway.address,
      data: executeData,
    });
  }

  public executeWithToken(
    destContractAddress: string,
    commandId: string,
    sourceChain: string,
    sourceAddress: string,
    payload: string,
    tokenSymbol: string,
    amount: string
  ) {
    const executable: IAxelarExecutable = IAxelarExecutable__factory.connect(
      destContractAddress,
      this.wallet
    );
    return executable.populateTransaction
      .executeWithToken(
        commandId,
        sourceChain,
        sourceAddress,
        payload,
        tokenSymbol,
        amount
      )
      .then((tx) => this.submitTx(tx));
  }

  private submitTx(
    tx: ethers.providers.TransactionRequest,
    retryAttempt = 0
  ): Promise<ethers.providers.TransactionReceipt> {
    // submit tx with retries
    if (retryAttempt >= this.maxRetry) throw new Error('Max retry exceeded');
    return this.wallet
      .sendTransaction(tx)
      .then((t) => t.wait())
      .catch(async () => {
        await sleep(this.retryDelay);
        logger.info(`Retrying tx: ${retryAttempt}`);
        return this.submitTx(tx, retryAttempt + 1);
      });
  }
}
