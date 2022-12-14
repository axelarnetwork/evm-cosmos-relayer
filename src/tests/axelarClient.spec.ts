import { AxelarClient } from "../";

describe("AxelarClient", () => {
  let client: AxelarClient;

  beforeEach(async () => {
     client = await AxelarClient.init();
  })

  it("should be able to query balance from devnet", async () => {
    const address = "axelar199km5vjuu6edyjlwx62wvmr6uqeghyz4rwmyvk"
    const balance = await client.getBalance(address)
    console.log(balance)
  })
})
