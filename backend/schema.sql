-- Initialize database schema for XEN Burn Analytics

-- Chains table for multi-chain support
CREATE TABLE IF NOT EXISTS chains (
    chain_id INTEGER PRIMARY KEY,
    chain_name VARCHAR(50) NOT NULL,
    rpc_url TEXT,
    xen_contract_address TEXT,
    xburn_minter_contract_address TEXT,
    xburn_nft_contract_address TEXT,
    last_indexed_block BIGINT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Burn events table to track all burn-related events
CREATE TABLE IF NOT EXISTS burn_events (
    id SERIAL PRIMARY KEY,
    chain_id INTEGER NOT NULL REFERENCES chains(chain_id),
    transaction_hash TEXT NOT NULL,
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMP NOT NULL,
    user_address TEXT,
    xen_amount_direct NUMERIC(78, 0),
    xen_amount_accumulated NUMERIC(78, 0),
    contract_address TEXT NOT NULL,
    event_type TEXT NOT NULL,
    raw_log JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(transaction_hash, event_type)
);

-- Burn positions table to track NFT burn positions
CREATE TABLE IF NOT EXISTS burn_positions (
    id SERIAL PRIMARY KEY,
    chain_id INTEGER NOT NULL REFERENCES chains(chain_id),
    nft_id TEXT NOT NULL,
    user_address TEXT NOT NULL,
    xen_burned_total NUMERIC(78, 0) NOT NULL,
    lock_period_days INTEGER NOT NULL,
    maturity_timestamp TIMESTAMP NOT NULL,
    mint_transaction_hash TEXT NOT NULL,
    mint_block_timestamp TIMESTAMP NOT NULL,
    status TEXT NOT NULL, -- locked, claimed, emergency_withdrawn, etc.
    amplifier_at_burn NUMERIC(78, 0),
    xburn_reward_potential NUMERIC(78, 0),
    claimed_transaction_hash TEXT,
    claimed_block_timestamp TIMESTAMP,
    claimed_xburn_amount NUMERIC(78, 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(chain_id, nft_id)
);

-- Pre-aggregated analytics for dashboard displays
CREATE TABLE IF NOT EXISTS analytics (
    metric_name TEXT PRIMARY KEY,
    metric_value NUMERIC NOT NULL,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Initialize Base chain in the chains table
INSERT INTO chains (chain_id, chain_name, xen_contract_address, xburn_minter_contract_address, xburn_nft_contract_address)
VALUES (
    1, -- Using 1 as a placeholder, Base has chain_id 8453 but we're using 1 in our indexer 
    'Base',
    '0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5',
    '0xe89AFDeFeBDba033f6e750615f0A0f1A37C78c4A',
    '0x305C60D2fEf49FADfEe67EC530DE98f67bac861D'
)
ON CONFLICT (chain_id) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS burn_events_block_timestamp_idx ON burn_events(block_timestamp);
CREATE INDEX IF NOT EXISTS burn_events_user_address_idx ON burn_events(user_address);
CREATE INDEX IF NOT EXISTS burn_events_event_type_idx ON burn_events(event_type);
CREATE INDEX IF NOT EXISTS burn_positions_user_address_idx ON burn_positions(user_address);
CREATE INDEX IF NOT EXISTS burn_positions_status_idx ON burn_positions(status);
CREATE INDEX IF NOT EXISTS burn_positions_maturity_idx ON burn_positions(maturity_timestamp);

-- Function to update 'updated_at' columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for 'updated_at'
CREATE TRIGGER update_chains_updated_at
BEFORE UPDATE ON chains
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_burn_positions_updated_at
BEFORE UPDATE ON burn_positions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Example analytics entries:
-- Total XEN burned (global or per chain)
-- Active burn positions count
-- XBURN supply metrics
-- Current amplifier value (if applicable as a global/chain-specific metric) 