CREATE TABLE relay_data (
    id VARCHAR(255) PRIMARY KEY NOT NULL,
    packet_sequence INT UNIQUE NOT NULL,
    src_channel_id VARCHAR(255),
    dst_channel_id VARCHAR(255),
    amount VARCHAR(255),
    denom VARCHAR(255),
    ibc_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

