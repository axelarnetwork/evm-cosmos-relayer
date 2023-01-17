CREATE TABLE call_contract_with_token(
    id VARCHAR(255) PRIMARY KEY NOT NULL,
    contract_address VARCHAR(255),
    amount VARCHAR(255),
    symbol VARCHAR(255),
    payload VARCHAR(255),
    payload_hash VARCHAR(255),
    source_address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE relay_data (
    id VARCHAR(255) PRIMARY KEY NOT NULL,
    packet_sequence INT UNIQUE,
    execute_hash VARCHAR(255),
    call_contract_with_token VARCHAR(255) CONSTRAINT fk_relay_data_call_contract_with_token REFERENCES call_contract_with_token(id) NULL,
    status INT DEFAULT 0 CHECK (status IN (0, 1, 2, 3)), -- 0: pending, 1: executed, 2: completed, 3: failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

