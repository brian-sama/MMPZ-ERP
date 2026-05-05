-- Migration: Leave Tracking and E-Signatures
-- Date: 2026-05-05

-- 1. Update Unified Submissions for Metadata and Signatures
ALTER TABLE unified_submissions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE unified_submissions ADD COLUMN IF NOT EXISTS signatures JSONB DEFAULT '[]';

-- 2. Create Leave Balances Table
CREATE TABLE IF NOT EXISTS leave_balances (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    allocated_days DECIMAL(5, 2) NOT NULL DEFAULT 21.00,
    used_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    pending_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    last_accrual_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Initialize leave balances for existing users
INSERT INTO leave_balances (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- 4. Add index for metadata searches if needed
CREATE INDEX IF NOT EXISTS idx_unified_submissions_metadata ON unified_submissions USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_unified_submissions_signatures ON unified_submissions USING gin (signatures);
