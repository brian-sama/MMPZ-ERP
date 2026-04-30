ALTER TABLE approvals
    ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_approvals_requested_by
    ON approvals(requested_by_user_id);
