-- MMPZ ERP Redesign Migration - 2026-05-01
-- Facilitator Workflow and Unified Submission Model

-- 1. Create Unified Submissions Table
CREATE TABLE IF NOT EXISTS unified_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submitter_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_type VARCHAR(100) NOT NULL, -- e.g., 'leave_application', 'request_for_funds', 'activity_report', 'field_report'
    department_category VARCHAR(100),
    title VARCHAR(255),
    description TEXT,
    file_path TEXT,
    file_name VARCHAR(255),
    mime_type VARCHAR(100),
    current_handler_role VARCHAR(80),
    current_handler_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'submitted', -- submitted, reviewed, verified, approved, rejected
    approval_required BOOLEAN DEFAULT TRUE,
    related_entity_type VARCHAR(60), -- e.g., 'field_activity'
    related_entity_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Submission Workflow Logs
CREATE TABLE IF NOT EXISTS submission_workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES unified_submissions(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- e.g., 'submit', 'review', 'verify', 'approve', 'reject', 'request_changes'
    from_status VARCHAR(30),
    to_status VARCHAR(30),
    acted_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Field Activities Table
CREATE TABLE IF NOT EXISTS field_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facilitator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    indicator_id INT REFERENCES indicators(id) ON DELETE SET NULL,
    activity_date DATE NOT NULL,
    location TEXT,
    description TEXT,
    plan_submission_id UUID REFERENCES unified_submissions(id) ON DELETE SET NULL, -- Link to the uploaded Activity Plan
    assigned_reviewer_id INT REFERENCES users(id) ON DELETE SET NULL, -- The Intern or Officer in charge
    status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, submitted, reviewed, verified
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Update Existing Tables to link to Field Activities
ALTER TABLE volunteer_activity_reports ADD COLUMN IF NOT EXISTS field_activity_id UUID REFERENCES field_activities(id) ON DELETE CASCADE;
ALTER TABLE volunteer_submissions ADD COLUMN IF NOT EXISTS field_activity_id UUID REFERENCES field_activities(id) ON DELETE CASCADE;

-- 5. Update Announcements for Approval Flow
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS approved_by_user_id INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved'; -- pending, approved, rejected

-- 5. Seed Permissions for Admin Assistant and Logistics Assistant
-- Admin Assistant: access to finance dashboards
INSERT INTO role_permissions (role_code, permission_code) VALUES
    ('ADMIN_ASSISTANT', 'expense.read'),
    ('ADMIN_ASSISTANT', 'settings.finance_threshold.read'),
    ('LOGISTICS_ASSISTANT', 'expense.read')
ON CONFLICT DO NOTHING;

-- 6. Align Social Services and Communications Interns
-- Assuming they should have the same permissions as COMMUNITY_DEVELOPMENT_OFFICER as per previous schema, 
-- but let's ensure they are identical.
DELETE FROM role_permissions WHERE role_code IN ('SOCIAL_SERVICES_INTERN', 'YOUTH_COMMUNICATIONS_INTERN');

INSERT INTO role_permissions (role_code, permission_code)
SELECT 'SOCIAL_SERVICES_INTERN', permission_code
FROM role_permissions
WHERE role_code = 'PSYCHOSOCIAL_SUPPORT_OFFICER'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code)
SELECT 'YOUTH_COMMUNICATIONS_INTERN', permission_code
FROM role_permissions
WHERE role_code = 'PSYCHOSOCIAL_SUPPORT_OFFICER'
ON CONFLICT DO NOTHING;

-- 7. Add Audit Triggers for New Tables
DROP TRIGGER IF EXISTS audit_unified_submissions_trigger ON unified_submissions;
CREATE TRIGGER audit_unified_submissions_trigger
AFTER INSERT OR UPDATE OR DELETE ON unified_submissions
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_field_activities_trigger ON field_activities;
CREATE TRIGGER audit_field_activities_trigger
AFTER INSERT OR UPDATE OR DELETE ON field_activities
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
