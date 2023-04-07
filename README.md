# EVM to Cosmos Relayer

A relayer between cosmos and evm chains on Axelar testnet.

## How to run?

The relayer is currently deployed on the heroku server, so you don't have to run it. But here's how you can also run it in your local machine.

### Prerequisite

Make sure docker engine is running. We use docker for spin up local postgres db.

### Steps

1. Copy `.env.example` to `.env` and fill all values.
2. Run `yarn`
3. Run `make up` to run postgres db container.
4. Wait until the db is ready to accept connection, then run `make prisma-push` to create database and tables.
5. Run `prisma-generate` to generate db types.
6. Run `yarn start:dev` to start the relayer

## API

The relayer has stored the cross-chain events in the database. It exposes an API for developers for the debugging purpose.

The API documentation in available [here](https://evm-cosmos-relayer-testnet.herokuapp.com/documentation).

## Examples

Work in progress
