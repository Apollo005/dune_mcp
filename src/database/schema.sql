-- PostgreSQL schema for MCP payment tracking
-- This prevents replay attacks by tracking used transaction signatures

-- Create database if it doesn't exist
-- Run: createdb mcp_payments

-- Table to track used payment signatures
CREATE TABLE IF NOT EXISTS payment_signatures (
    id SERIAL PRIMARY KEY,
    signature VARCHAR(88) NOT NULL UNIQUE, -- Solana signatures are 88 chars
    network VARCHAR(20) NOT NULL, -- 'solana', 'ethereum', etc.
    amount BIGINT NOT NULL, -- Payment amount in smallest unit (lamports, wei)
    asset VARCHAR(100) NOT NULL, -- 'native', token mint address, etc.
    sender_address VARCHAR(100) NOT NULL,
    receiver_address VARCHAR(100) NOT NULL,
    api_endpoint VARCHAR(500) NOT NULL, -- Which endpoint was accessed
    block_time TIMESTAMP, -- When transaction was confirmed on blockchain
    first_used_at TIMESTAMP NOT NULL DEFAULT NOW(), -- When signature was first used
    usage_count INTEGER NOT NULL DEFAULT 1, -- How many times attempted (should stay 1)
    ip_address INET, -- Optional: track requesting IP
    user_agent TEXT, -- Optional: track user agent
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for fast signature lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_payment_signatures_signature ON payment_signatures(signature);

-- Index for monitoring by endpoint
CREATE INDEX IF NOT EXISTS idx_payment_signatures_endpoint ON payment_signatures(api_endpoint);

-- Index for monitoring by time
CREATE INDEX IF NOT EXISTS idx_payment_signatures_created_at ON payment_signatures(created_at);

-- Index for monitoring by receiver
CREATE INDEX IF NOT EXISTS idx_payment_signatures_receiver ON payment_signatures(receiver_address);

-- Table to track payment challenges (for proper x402 implementation)
CREATE TABLE IF NOT EXISTS payment_challenges (
    id SERIAL PRIMARY KEY,
    challenge_id VARCHAR(64) NOT NULL UNIQUE, -- UUID or random string
    api_endpoint VARCHAR(500) NOT NULL,
    required_amount BIGINT NOT NULL,
    required_asset VARCHAR(100) NOT NULL,
    network VARCHAR(20) NOT NULL,
    receiver_address VARCHAR(100) NOT NULL,
    expires_at TIMESTAMP NOT NULL, -- Challenge expiry (5-10 minutes)
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_signature VARCHAR(88), -- Signature that fulfilled this challenge
    used_at TIMESTAMP,
    client_ip INET,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for fast challenge lookups
CREATE INDEX IF NOT EXISTS idx_payment_challenges_challenge_id ON payment_challenges(challenge_id);

-- Index for cleanup of expired challenges
CREATE INDEX IF NOT EXISTS idx_payment_challenges_expires_at ON payment_challenges(expires_at);

-- Table for API usage analytics
CREATE TABLE IF NOT EXISTS api_usage_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    paid_requests INTEGER NOT NULL DEFAULT 0,
    total_revenue_lamports BIGINT NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique constraint for daily stats per endpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_usage_stats_date_endpoint 
ON api_usage_stats(date, endpoint);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on payment_signatures
CREATE OR REPLACE TRIGGER update_payment_signatures_updated_at 
    BEFORE UPDATE ON payment_signatures 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at on api_usage_stats
CREATE OR REPLACE TRIGGER update_api_usage_stats_updated_at 
    BEFORE UPDATE ON api_usage_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for easy monitoring of recent payments
CREATE OR REPLACE VIEW recent_payments AS
SELECT 
    signature,
    network,
    amount,
    asset,
    sender_address,
    receiver_address,
    api_endpoint,
    first_used_at,
    usage_count,
    block_time
FROM payment_signatures 
ORDER BY first_used_at DESC 
LIMIT 100;

-- View for daily revenue summary
CREATE OR REPLACE VIEW daily_revenue AS
SELECT 
    date,
    SUM(total_revenue_lamports) as total_lamports,
    SUM(total_revenue_lamports) / 1000000000.0 as total_sol,
    SUM(paid_requests) as total_paid_requests,
    COUNT(DISTINCT endpoint) as unique_endpoints
FROM api_usage_stats 
GROUP BY date 
ORDER BY date DESC;

-- Sample queries for monitoring:
-- SELECT * FROM recent_payments;
-- SELECT * FROM daily_revenue;
-- SELECT COUNT(*) FROM payment_signatures WHERE created_at > NOW() - INTERVAL '24 hours';
-- SELECT api_endpoint, COUNT(*) FROM payment_signatures GROUP BY api_endpoint ORDER BY COUNT(*) DESC;
