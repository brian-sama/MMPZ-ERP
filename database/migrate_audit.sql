-- Migration: Add audit columns to progress_updates
-- Run this on existing databases to add the audit workflow columns
-- 1. Drop and recreate the constraint with new values
ALTER TABLE progress_updates DROP CONSTRAINT IF EXISTS progress_updates_approval_status_check;
ALTER TABLE progress_updates
ADD CONSTRAINT progress_updates_approval_status_check CHECK (
        approval_status IN (
            'pending',
            'approved',
            'rejected',
            'awaiting_audit',
            'audited'
        )
    );
-- 2. Add new columns for audit tracking
ALTER TABLE progress_updates
ADD COLUMN IF NOT EXISTS tally_value INT DEFAULT NULL;
ALTER TABLE progress_updates
ADD COLUMN IF NOT EXISTS tally_status JSONB DEFAULT NULL;
-- Done