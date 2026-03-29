-- Deprecated bootstrap script.
-- The canonical bootstrap now lives in database/schema.sql so both Docker init
-- and scripted migrations build the same schema.
-- This file is kept only as historical reference.
-- 3.1 M&E and Programs Hierarchy
CREATE TABLE IF NOT EXISTS outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id INT REFERENCES activities(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    target_value INT DEFAULT 0,
    current_value INT DEFAULT 0,
    unit VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS indicator_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_id INT REFERENCES indicators(id) ON DELETE CASCADE,
    reporting_period VARCHAR(20) NOT NULL,
    -- e.g. '2026-02'
    target_value INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(indicator_id, reporting_period)
);
CREATE TABLE IF NOT EXISTS indicator_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_id INT REFERENCES indicators(id) ON DELETE CASCADE,
    target_id UUID REFERENCES indicator_targets(id) ON DELETE
    SET NULL,
        reporting_period VARCHAR(20) NOT NULL,
        value INT NOT NULL,
        notes TEXT,
        reported_by_user_id INT REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        -- pending, approved, rejected
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 3.2 Facilitators
CREATE TABLE IF NOT EXISTS development_facilitators (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    gender VARCHAR(20),
    age_bracket VARCHAR(20),
    phone VARCHAR(20),
    address TEXT,
    status VARCHAR(20) DEFAULT 'active',
    joined_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS facilitator_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facilitator_user_id INT REFERENCES development_facilitators(user_id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(facilitator_user_id, project_id)
);
CREATE TABLE IF NOT EXISTS facilitator_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES facilitator_assignments(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    -- present, absent, etc.
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 3.3 Finance & Procurement
CREATE TABLE IF NOT EXISTS donors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    code VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID REFERENCES donors(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE,
    total_amount DECIMAL(15, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id UUID REFERENCES grants(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE
    SET NULL,
        name VARCHAR(200),
        total_amount DECIMAL(15, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS budget_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
    code VARCHAR(50),
    description TEXT,
    allocated_amount DECIMAL(15, 2) NOT NULL,
    used_amount DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS procurement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by_user_id INT REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    budget_line_id UUID REFERENCES budget_lines(id),
    title VARCHAR(255) NOT NULL,
    justification TEXT,
    total_estimated_cost DECIMAL(15, 2),
    status VARCHAR(30) DEFAULT 'draft',
    -- draft, pending_approval, approved, ordered, received, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS procurement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES procurement_requests(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50),
    estimated_unit_cost DECIMAL(15, 2),
    actual_unit_cost DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 3.4 Governance & Centralized Approvals
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    -- 'expense', 'procurement', 'project', 'program', 'facilitator_onboarding', 'progress_report'
    entity_id VARCHAR(120) NOT NULL,
    requested_by_user_id INT REFERENCES users(id),
    current_step INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',
    -- pending, approved, rejected, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS approval_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id UUID REFERENCES approvals(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    action VARCHAR(20) NOT NULL,
    -- approved, rejected, sent_back
    actor_user_id INT REFERENCES users(id),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Traceability columns for legacy data
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS legacy_source_table VARCHAR(50);
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS legacy_source_id VARCHAR(100);
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS legacy_source_table VARCHAR(50);
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS legacy_source_id VARCHAR(100);
ALTER TABLE indicators
ADD COLUMN IF NOT EXISTS legacy_source_table VARCHAR(50);
ALTER TABLE indicators
ADD COLUMN IF NOT EXISTS legacy_source_id VARCHAR(100);
-- Enable auditing for new tables
DROP TRIGGER IF EXISTS audit_outputs_trigger ON outputs;
CREATE TRIGGER audit_outputs_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON outputs FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
DROP TRIGGER IF EXISTS audit_indicator_targets_trigger ON indicator_targets;
CREATE TRIGGER audit_indicator_targets_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON indicator_targets FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
DROP TRIGGER IF EXISTS audit_indicator_progress_trigger ON indicator_progress;
CREATE TRIGGER audit_indicator_progress_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON indicator_progress FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
DROP TRIGGER IF EXISTS audit_facilitators_trigger ON development_facilitators;
CREATE TRIGGER audit_facilitators_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON development_facilitators FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('user_id');
DROP TRIGGER IF EXISTS audit_donors_trigger ON donors;
CREATE TRIGGER audit_donors_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON donors FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
DROP TRIGGER IF EXISTS audit_grants_trigger ON grants;
CREATE TRIGGER audit_grants_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON grants FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
DROP TRIGGER IF EXISTS audit_budgets_trigger ON budgets;
CREATE TRIGGER audit_budgets_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON budgets FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
DROP TRIGGER IF EXISTS audit_procurement_trigger ON procurement_requests;
CREATE TRIGGER audit_procurement_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON procurement_requests FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
DROP TRIGGER IF EXISTS audit_approvals_trigger ON approvals;
CREATE TRIGGER audit_approvals_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON approvals FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
