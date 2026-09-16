-- Align ERP field activities with the shared ERP -> Compass -> mobile contract.
ALTER TABLE field_activities ADD COLUMN IF NOT EXISTS planner_id INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE field_activities ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE field_activities ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
ALTER TABLE field_activities ADD COLUMN IF NOT EXISTS compass_activity_id TEXT;
ALTER TABLE field_activities ADD COLUMN IF NOT EXISTS compass_plan_id TEXT;
ALTER TABLE field_activities ADD COLUMN IF NOT EXISTS compass_sync_status VARCHAR(30) NOT NULL DEFAULT 'NOT_SYNCED';
ALTER TABLE field_activities ADD COLUMN IF NOT EXISTS compass_sync_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE field_activities ADD COLUMN IF NOT EXISTS compass_last_error TEXT;
ALTER TABLE field_activities ADD COLUMN IF NOT EXISTS compass_last_attempt_at TIMESTAMP;
ALTER TABLE field_activities ADD COLUMN IF NOT EXISTS compass_next_retry_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_field_activities_compass_sync
    ON field_activities(compass_sync_status, compass_next_retry_at);
CREATE INDEX IF NOT EXISTS idx_field_activities_compass_activity
    ON field_activities(compass_activity_id);
