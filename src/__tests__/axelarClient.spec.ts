import { AxelarClient, config } from "..";

describe("AxelarClient", () => {
  let client: AxelarClient;

  beforeEach(async () => {
    client = await AxelarClient.init(config.cosmos.demo);
  });

  it("should be able to query balance from devnet", async () => {
    const denom =
      "ibc/52E89E856228AD91E1ADE256E9EDEA4F2E147A426E14F71BE7737EB43CA2FCC5";
    const address = "axelar199km5vjuu6edyjlwx62wvmr6uqeghyz4rwmyvk";
    const balance = await client.getBalance(address, denom);
    expect(balance).toEqual({
      denom: denom,
      amount: expect.anything(),
    });
  });

  // it("should send a confirm evm tx", async () => {});
});
