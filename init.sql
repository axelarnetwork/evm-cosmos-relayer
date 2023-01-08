CREATE TABLE relay_data (
    txhash VARCHAR(255) PRIMARY KEY NOT NULL,
    packetSequence INT UNIQUE NOT NULL,
    srcChannelId VARCHAR(255),
    dstChannelId VARCHAR(255),
    amount VARCHAR(255),
    denom VARCHAR(255),
    ibcHash: VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

