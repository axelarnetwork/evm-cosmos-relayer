# EVM to Cosmos Relayer

1. Copy `.env.example` to `.env` and fill all values.
2. Run `yarn`
3. (Optional) Update your recipient address in `relay.ts`. It is used for displaying your changed balance after relayed.
4. Make sure docker is running on your local machine.
5. Run `make up-force` to run postgres db container.
6. Wait until the db is ready to accept connection, then run `yarn start:dev` to start the relayer.
