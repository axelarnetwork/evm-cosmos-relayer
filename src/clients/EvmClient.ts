import { Wallet, ethers } from "ethers";
import { EvmNetworkConfig } from "../config/types";
import { IAxelarGateway__factory, IAxelarGateway, IAxelarExecutable, IAxelarExecutable__factory } from "../types/contracts";

export class EvmClient {
  private wallet: Wallet
  private gateway: IAxelarGateway;

  constructor(chain: EvmNetworkConfig) {
    this.wallet = new Wallet(chain.privateKey, new ethers.providers.JsonRpcProvider(chain.rpcUrl));
    this.gateway = IAxelarGateway__factory.connect(
      chain.gateway,
      this.wallet
    );
  }

  public execute(executeData: string) {
    return this.wallet.sendTransaction({
      to: this.gateway.address,
      data: executeData
    }).then(t => t.wait())
  }

  public callContractWithToken(destContractAddress: string, commandId: string, sourceChain: string, sourceAddress: string, payload: string, tokenSymbol: string, amount: string) {
    const executable: IAxelarExecutable = IAxelarExecutable__factory.connect(destContractAddress, this.wallet);
    return executable.executeWithToken(commandId, sourceChain, sourceAddress, payload, tokenSymbol, amount).then(tx => tx.wait());
  }
}
