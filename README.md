# EVM to Cosmos Relayer

A relayer between cosmos and evm chains on Axelar devnet.

## How to run?

### Prerequisite

You have to run the hermes in your local machine.

> TODO: we have to either add steps to run hermes, or deploy it on the server and remove prerequisite step here.

The relayer is currently deployed on the heroku server, so you don't have to run it. But here's how you can also run it in your local machine.

1. Copy `.env.example` to `.env` and fill all values.
2. Run `yarn`
3. (Optional) Update your recipient address in `relay.ts`. It is used for displaying your changed balance after relayed.
4. Make sure docker is running on your local machine.
5. Run `make up` to run postgres db container.
6. Wait until the db is ready to accept connection, then run `yarn start:dev` to start the relayer.

## API

The relayer has stored the cross-chain events in the database. It exposes an API for developers for the debugging purpose.

The API documentation in available [here](https://evm-cosmos-relayer.herokuapp.com/documentation).

## Examples

### Cosmos to Evm

Make sure you have set `EVM_PRIVATE_KEY` in `.env` and have at least 1 `USDA` and some native balance.

```
yarn cosmos-gmp
```

### Evm to Cosmos

1. `yarn` to install dependency
2. `yarn task multisend your_axelar_account amount` e.g. `yarn task multisend axelar199km5vjuu6edyjlwx62wvmr6uqeghyz4rwmyvk 10000`
