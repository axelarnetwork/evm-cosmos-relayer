import { AxelarClient, config } from '..';

describe('AxelarClient', () => {
  let client: AxelarClient;

  beforeEach(async () => {
    client = await AxelarClient.init(config.cosmos.testnet);
  });

  it('should be able to query balance from demo chain', async () => {
    const client = await AxelarClient.init(config.cosmos.osmosis);
    const denom =
      'ibc/52E89E856228AD91E1ADE256E9EDEA4F2E147A426E14F71BE7737EB43CA2FCC5';
    const address = 'axelar199km5vjuu6edyjlwx62wvmr6uqeghyz4rwmyvk';
    const balance = await client.getBalance(address, denom);
    console.log(balance);
    expect(balance).toEqual({
      denom: denom,
      amount: expect.anything(),
    });
  });

  it('event should be confirmed', async () => {
    const event = await client.isContractCallWithTokenConfirmed(
      'goerli',
      '0xb1bc7fe20424a261f228907d49a6b1c04995f32b2ab264f5036a7384ae6c33bf-5'
    );
    expect(event).toBeTruthy();
  });

  // it("should send a confirm evm tx", async () => {});
});
