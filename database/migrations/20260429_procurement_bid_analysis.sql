-- Migration: add procurement bid analysis workflow fields
-- Date: 2026-04-29

ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS bid_analysis_summary TEXT;
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS bid_analysis_recommendation TEXT;
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS bid_analysis_status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS bid_analysis_reviewed_by_user_id INT NULL;
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS bid_analysis_reviewed_at TIMESTAMP NULL;
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS bid_analysis_approved_by_user_id INT NULL;
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS bid_analysis_approved_at TIMESTAMP NULL;

ALTER TABLE procurement_requests DROP CONSTRAINT IF EXISTS procurement_requests_bid_analysis_status_check;
ALTER TABLE procurement_requests
    ADD CONSTRAINT procurement_requests_bid_analysis_status_check
    CHECK (bid_analysis_status IN ('pending', 'recommended', 'approved', 'rejected', 'waived'));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'procurement_requests_bid_analysis_reviewed_by_user_id_fkey'
    ) THEN
        ALTER TABLE procurement_requests
            ADD CONSTRAINT procurement_requests_bid_analysis_reviewed_by_user_id_fkey
            FOREIGN KEY (bid_analysis_reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'procurement_requests_bid_analysis_approved_by_user_id_fkey'
    ) THEN
        ALTER TABLE procurement_requests
            ADD CONSTRAINT procurement_requests_bid_analysis_approved_by_user_id_fkey
            FOREIGN KEY (bid_analysis_approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
