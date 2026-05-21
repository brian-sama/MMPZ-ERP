-- Migration: Add Funding Requests and Liquidations
-- Date: 2026-05-21

-- 1. Create Funding Requests Table
CREATE TABLE IF NOT EXISTS funding_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submitter_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    indicator_id INT REFERENCES indicators(id) ON DELETE SET NULL,
    district_code VARCHAR(100),
    district_name VARCHAR(255),
    activity_name VARCHAR(255) NOT NULL,
    narrative_justification TEXT,
    total_requested_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    submission_id UUID REFERENCES unified_submissions(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Funding Request Items Table
CREATE TABLE IF NOT EXISTS funding_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funding_request_id UUID NOT NULL REFERENCES funding_requests(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (category IN (
        'personnel', 'materials', 'travel', 'training', 'equipment', 'procurement', 'logistics', 'other'
    )),
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
    unit_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    total_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_cost >= 0),
    procurement_linked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Liquidations Table
CREATE TABLE IF NOT EXISTS liquidations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funding_request_id UUID NOT NULL REFERENCES funding_requests(id) ON DELETE CASCADE UNIQUE,
    submitted_by_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actual_amount_spent DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (actual_amount_spent >= 0),
    variance_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    receipts JSONB DEFAULT '[]'::jsonb, -- array of uploaded receipt files {path, name, mimeType}
    items JSONB DEFAULT '[]'::jsonb, -- detailed items actual spent and comments
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_funding_requests_project ON funding_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_funding_requests_submission ON funding_requests(submission_id);
CREATE INDEX IF NOT EXISTS idx_funding_requests_submitter ON funding_requests(submitter_user_id);
CREATE INDEX IF NOT EXISTS idx_funding_request_items_request ON funding_request_items(funding_request_id);
CREATE INDEX IF NOT EXISTS idx_liquidations_request ON liquidations(funding_request_id);

-- 5. Add Audit Triggers (referencing audit_trigger_fn defined in main schema.sql)
DROP TRIGGER IF EXISTS audit_funding_requests_trigger ON funding_requests;
CREATE TRIGGER audit_funding_requests_trigger
AFTER INSERT OR UPDATE OR DELETE ON funding_requests
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_funding_request_items_trigger ON funding_request_items;
CREATE TRIGGER audit_funding_request_items_trigger
AFTER INSERT OR UPDATE OR DELETE ON funding_request_items
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_liquidations_trigger ON liquidations;
CREATE TRIGGER audit_liquidations_trigger
AFTER INSERT OR UPDATE OR DELETE ON liquidations
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
