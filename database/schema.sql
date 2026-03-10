-- MMPZ ERP Comprehensive Schema
-- This is the single authoritative schema file for local and deployment migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. Governance Roles and Permissions
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
    code VARCHAR(80) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_executive BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    code VARCHAR(120) PRIMARY KEY,
    description TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_code VARCHAR(80) NOT NULL,
    permission_code VARCHAR(120) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_code, permission_code),
    FOREIGN KEY (role_code) REFERENCES roles(code) ON DELETE CASCADE,
    FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
);

INSERT INTO roles (code, name, description, is_executive)
VALUES
    ('DIRECTOR', 'Director', 'Executive authority for strategic and final approvals', TRUE),
    ('FINANCE_ADMIN_OFFICER', 'Finance and Admin Officer', 'Financial accountability and administrative leadership', FALSE),
    ('ADMIN_ASSISTANT', 'Admin Assistant', 'Operational support and user coordination', FALSE),
    ('LOGISTICS_ASSISTANT', 'Logistics Assistant', 'Procurement and logistics tracking support', FALSE),
    ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'Psychosocial Support Officer', 'Technical lead for psychosocial interventions', FALSE),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'Community Development Officer', 'Technical lead for community programs', FALSE),
    ('ME_INTERN_ACTING_OFFICER', 'M&E Intern (Acting Officer)', 'Interim monitoring and evaluation oversight', FALSE),
    ('SOCIAL_SERVICES_INTERN', 'Social Services Intern', 'Program support and field documentation', FALSE),
    ('YOUTH_COMMUNICATIONS_INTERN', 'Youth & Communications Intern', 'Outreach and communications support', FALSE),
    ('DEVELOPMENT_FACILITATOR', 'Development Facilitator', 'Volunteer field implementation role', FALSE)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_executive = EXCLUDED.is_executive;

INSERT INTO permissions (code, description)
VALUES
    ('user.view', 'View user accounts'),
    ('user.create', 'Create user accounts'),
    ('user.update', 'Update user accounts'),
    ('user.delete', 'Delete user accounts'),
    ('user.assign_role', 'Assign or change user roles'),
    ('role.confirm', 'Confirm pending role assignments'),
    ('indicator.read_all', 'View all indicators'),
    ('indicator.read_assigned', 'View assigned indicators only'),
    ('indicator.create', 'Create indicators'),
    ('indicator.update', 'Update indicators'),
    ('indicator.delete', 'Delete indicators'),
    ('indicator.complete', 'Mark indicators complete'),
    ('progress.create', 'Create progress updates'),
    ('progress.approve', 'Approve progress updates'),
    ('activity.read', 'View activities'),
    ('activity.create', 'Create activities'),
    ('activity.delete', 'Delete activities'),
    ('volunteer.submit', 'Submit volunteer reports and data'),
    ('volunteer.read_own', 'View own volunteer records'),
    ('volunteer.read_all', 'View all volunteer records'),
    ('kobo.manage', 'Manage Kobo configuration and links'),
    ('kobo.sync', 'Run Kobo sync actions'),
    ('settings.finance_threshold.read', 'Read finance threshold setting'),
    ('settings.finance_threshold.update', 'Update finance threshold setting'),
    ('program.read', 'View programs'),
    ('program.create', 'Create programs'),
    ('program.update', 'Update programs'),
    ('project.read', 'View projects'),
    ('project.create', 'Create projects'),
    ('project.update', 'Update projects'),
    ('expense.read', 'View expense requests'),
    ('expense.create', 'Create expense requests'),
    ('expense.review_finance', 'Finance review of expense requests'),
    ('expense.approve_director', 'Director final approval for expense requests'),
    ('expense.pay', 'Mark expense requests as paid'),
    ('approval.read', 'View approval queues'),
    ('approval.action', 'Action approval requests'),
    ('governance.pending_roles.read', 'View pending role assignments')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

-- =====================================================
-- 2. Users (legacy role migration + canonical role_code)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    role_code VARCHAR(80) NOT NULL DEFAULT 'DEVELOPMENT_FACILITATOR',
    password_hash VARCHAR(255),
    require_password_reset BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP NULL,
    role_assignment_status VARCHAR(30) NOT NULL DEFAULT 'pending_reassignment'
        CHECK (role_assignment_status IN ('confirmed', 'pending_reassignment')),
    role_confirmed_by_user_id INT NULL,
    role_confirmed_at TIMESTAMP NULL,
    role_legacy_snapshot VARCHAR(80) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_code VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_reset BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_assignment_status VARCHAR(30) DEFAULT 'pending_reassignment';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_confirmed_by_user_id INT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_confirmed_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_legacy_snapshot VARCHAR(80) NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role_code'
    ) THEN
        ALTER TABLE users RENAME COLUMN role TO role_code;
    END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role_code'
    ) THEN
        UPDATE users
        SET role_code = COALESCE(role_code, role)
        WHERE role IS NOT NULL;

        ALTER TABLE users DROP COLUMN role;
    END IF;
END $$;

UPDATE users
SET role_legacy_snapshot = COALESCE(role_legacy_snapshot, role_code)
WHERE role_legacy_snapshot IS NULL;

UPDATE users
SET role_code = CASE
    WHEN role_code IS NULL THEN 'DEVELOPMENT_FACILITATOR'
    WHEN UPPER(role_code) IN (
        'DIRECTOR',
        'FINANCE_ADMIN_OFFICER',
        'ADMIN_ASSISTANT',
        'LOGISTICS_ASSISTANT',
        'PSYCHOSOCIAL_SUPPORT_OFFICER',
        'COMMUNITY_DEVELOPMENT_OFFICER',
        'ME_INTERN_ACTING_OFFICER',
        'SOCIAL_SERVICES_INTERN',
        'YOUTH_COMMUNICATIONS_INTERN',
        'DEVELOPMENT_FACILITATOR'
    ) THEN UPPER(role_code)
    WHEN LOWER(role_code) = 'director' THEN 'DIRECTOR'
    WHEN LOWER(role_code) = 'admin' THEN 'DIRECTOR'
    WHEN LOWER(role_code) = 'officer' THEN 'ADMIN_ASSISTANT'
    WHEN LOWER(role_code) = 'intern' THEN 'SOCIAL_SERVICES_INTERN'
    WHEN LOWER(role_code) = 'volunteer' THEN 'DEVELOPMENT_FACILITATOR'
    ELSE 'DEVELOPMENT_FACILITATOR'
END;

UPDATE users
SET role_assignment_status = CASE
    WHEN LOWER(COALESCE(role_legacy_snapshot, '')) = 'director' THEN 'confirmed'
    ELSE 'pending_reassignment'
END
WHERE role_assignment_status IS NULL
   OR role_assignment_status NOT IN ('confirmed', 'pending_reassignment');

ALTER TABLE users
    ALTER COLUMN role_code SET NOT NULL,
    ALTER COLUMN role_assignment_status SET NOT NULL,
    ALTER COLUMN role_assignment_status SET DEFAULT 'pending_reassignment';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_assignment_status_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_role_assignment_status_check
            CHECK (role_assignment_status IN ('confirmed', 'pending_reassignment'));
    END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_code_fkey;
ALTER TABLE users
    ADD CONSTRAINT users_role_code_fkey
    FOREIGN KEY (role_code) REFERENCES roles(code) ON UPDATE CASCADE;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_confirmed_by_fkey;
ALTER TABLE users
    ADD CONSTRAINT users_role_confirmed_by_fkey
    FOREIGN KEY (role_confirmed_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
-- =====================================================
-- 3. Core Existing Tables (normalized and extended)
-- =====================================================
CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    created_by_user_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NULL,
    name TEXT NOT NULL,
    description TEXT,
    donor TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'paused', 'completed', 'archived')),
    owner_user_id INT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS program_id UUID NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'planning';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_user_id INT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'projects_program_id_fkey'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT projects_program_id_fkey
            FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'projects_owner_user_id_fkey'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT projects_owner_user_id_fkey
            FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS indicators (
    id SERIAL PRIMARY KEY,
    project_id UUID NULL,
    title VARCHAR(255) NOT NULL,
    target_value INT DEFAULT 0,
    current_value INT DEFAULT 0,
    total_budget DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    current_budget_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_by_user_id INT,
    status VARCHAR(20) DEFAULT 'active',
    priority VARCHAR(20) DEFAULT 'medium',
    reporting_period_start DATE NULL,
    reporting_period_end DATE NULL,
    risk_level TEXT DEFAULT 'low',
    auto_risk_score INTEGER DEFAULT 0,
    performance_score INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE indicators ADD COLUMN IF NOT EXISTS project_id UUID NULL;
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS reporting_period_start DATE NULL;
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS reporting_period_end DATE NULL;
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low';
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS auto_risk_score INTEGER DEFAULT 0;
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS performance_score INTEGER DEFAULT 0;
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW();
ALTER TABLE indicators ALTER COLUMN total_budget SET DEFAULT 0.00;
ALTER TABLE indicators ALTER COLUMN current_budget_balance SET DEFAULT 0.00;

ALTER TABLE indicators DROP CONSTRAINT IF EXISTS indicators_status_check;
ALTER TABLE indicators
    ADD CONSTRAINT indicators_status_check
    CHECK (status IN ('active', 'completed', 'flagged', 'archived'));

ALTER TABLE indicators DROP CONSTRAINT IF EXISTS indicators_priority_check;
ALTER TABLE indicators
    ADD CONSTRAINT indicators_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'critical'));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'indicators_project_id_fkey'
    ) THEN
        ALTER TABLE indicators
            ADD CONSTRAINT indicators_project_id_fkey
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS progress_updates (
    id SERIAL PRIMARY KEY,
    indicator_id INT NOT NULL,
    updated_by_user_id INT,
    previous_value INT DEFAULT 0,
    new_value INT NOT NULL,
    notes TEXT,
    approval_status VARCHAR(30) DEFAULT 'pending',
    approved_by_user_id INT,
    approval_date TIMESTAMP NULL,
    update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tally_value INT DEFAULT NULL,
    tally_status JSONB DEFAULT NULL,
    FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE progress_updates ADD COLUMN IF NOT EXISTS tally_value INT DEFAULT NULL;
ALTER TABLE progress_updates ADD COLUMN IF NOT EXISTS tally_status JSONB DEFAULT NULL;
ALTER TABLE progress_updates DROP CONSTRAINT IF EXISTS progress_updates_approval_status_check;
ALTER TABLE progress_updates
    ADD CONSTRAINT progress_updates_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'awaiting_audit', 'audited'));

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    related_indicator_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_indicator_id) REFERENCES indicators(id) ON DELETE CASCADE
);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'progress_update',
        'approval_needed',
        'approval_result',
        'budget_warning',
        'system',
        'governance'
    ));

CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    indicator_id INT,
    project_id UUID NULL,
    assigned_user_id INT NULL,
    description TEXT,
    activity_output TEXT,
    evidence_url TEXT,
    category VARCHAR(30) DEFAULT 'other',
    cost DECIMAL(12, 2) DEFAULT 0.00,
    activity_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS project_id UUID NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS assigned_user_id INT NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS activity_output TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE activities ALTER COLUMN cost SET DEFAULT 0.00;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_category_check;
ALTER TABLE activities
    ADD CONSTRAINT activities_category_check
    CHECK (category IN (
        'personnel',
        'materials',
        'travel',
        'training',
        'equipment',
        'procurement',
        'logistics',
        'other'
    ));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'activities_project_id_fkey'
    ) THEN
        ALTER TABLE activities
            ADD CONSTRAINT activities_project_id_fkey
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'activities_assigned_user_id_fkey'
    ) THEN
        ALTER TABLE activities
            ADD CONSTRAINT activities_assigned_user_id_fkey
            FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
CREATE TABLE IF NOT EXISTS kobo_config (
    id SERIAL PRIMARY KEY,
    server_url VARCHAR(255) NOT NULL DEFAULT 'https://kf.kobotoolbox.org',
    api_token VARCHAR(255),
    is_connected BOOLEAN DEFAULT FALSE,
    last_sync TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kobo_form_links (
    id SERIAL PRIMARY KEY,
    kobo_form_uid VARCHAR(100) NOT NULL,
    kobo_form_name VARCHAR(255),
    indicator_id INT NOT NULL,
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_synced_submission_id VARCHAR(100),
    submissions_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'approved',
    requested_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE kobo_form_links ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE kobo_form_links ADD COLUMN IF NOT EXISTS requested_by INT NULL;

CREATE TABLE IF NOT EXISTS kobo_submissions (
    id SERIAL PRIMARY KEY,
    kobo_submission_id VARCHAR(100) NOT NULL UNIQUE,
    kobo_form_uid VARCHAR(100) NOT NULL,
    indicator_id INT,
    submission_data JSONB,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS volunteer_submissions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    file_data TEXT,
    file_name VARCHAR(255),
    mime_type VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE volunteer_submissions DROP CONSTRAINT IF EXISTS volunteer_submissions_type_check;
ALTER TABLE volunteer_submissions
    ADD CONSTRAINT volunteer_submissions_type_check
    CHECK (type IN ('plan', 'concept_note', 'report', 'scanned_list'));

CREATE TABLE IF NOT EXISTS volunteer_participants (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    age INT,
    gender VARCHAR(20),
    contact VARCHAR(100),
    event_date DATE,
    volunteer_name VARCHAR(120),
    kobo_submission_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE volunteer_participants ADD COLUMN IF NOT EXISTS volunteer_name VARCHAR(120);
ALTER TABLE volunteer_participants ADD COLUMN IF NOT EXISTS kobo_submission_id VARCHAR(50) UNIQUE;

CREATE TABLE IF NOT EXISTS volunteer_activity_reports (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    indicator_id INT NOT NULL,
    male_count INT DEFAULT 0,
    female_count INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE
);

-- =====================================================
-- 4. ERP Governance and Financial Tables
-- =====================================================
CREATE TABLE IF NOT EXISTS user_supervisors (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    supervisor_user_id INT NOT NULL,
    relation_type VARCHAR(20) NOT NULL DEFAULT 'primary' CHECK (relation_type IN ('primary', 'secondary')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, supervisor_user_id, relation_type),
    CHECK (user_id <> supervisor_user_id)
);

CREATE TABLE IF NOT EXISTS user_role_history (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    previous_role_code VARCHAR(80),
    new_role_code VARCHAR(80) NOT NULL,
    changed_by_user_id INT NULL,
    reason TEXT,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (previous_role_code) REFERENCES roles(code) ON DELETE SET NULL,
    FOREIGN KEY (new_role_code) REFERENCES roles(code) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS project_assignments (
    id SERIAL PRIMARY KEY,
    project_id UUID NOT NULL,
    user_id INT NOT NULL,
    role_in_project VARCHAR(80) NOT NULL,
    assigned_by_user_id INT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (project_id, user_id, role_in_project)
);

CREATE TABLE IF NOT EXISTS expense_requests (
    id SERIAL PRIMARY KEY,
    project_id UUID NULL,
    related_indicator_id INT NULL,
    requested_by_user_id INT NOT NULL,
    reviewed_by_user_id INT NULL,
    approved_by_user_id INT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    rejection_reason TEXT,
    review_at TIMESTAMP NULL,
    director_decision_at TIMESTAMP NULL,
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (related_indicator_id) REFERENCES indicators(id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE expense_requests DROP CONSTRAINT IF EXISTS expense_requests_status_check;
ALTER TABLE expense_requests
    ADD CONSTRAINT expense_requests_status_check
    CHECK (status IN ('draft', 'pending_finance_review', 'pending_director_approval', 'approved', 'rejected', 'paid'));

CREATE TABLE IF NOT EXISTS approval_requests (
    id SERIAL PRIMARY KEY,
    request_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(120) NOT NULL,
    requested_by_user_id INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    final_decision_by_user_id INT NULL,
    final_decision_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (final_decision_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE approval_requests DROP CONSTRAINT IF EXISTS approval_requests_request_type_check;
ALTER TABLE approval_requests
    ADD CONSTRAINT approval_requests_request_type_check
    CHECK (request_type IN ('project', 'budget', 'expense', 'volunteer_onboarding', 'progress_update'));

ALTER TABLE approval_requests DROP CONSTRAINT IF EXISTS approval_requests_status_check;
ALTER TABLE approval_requests
    ADD CONSTRAINT approval_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

CREATE TABLE IF NOT EXISTS approval_steps (
    id SERIAL PRIMARY KEY,
    approval_request_id INT NOT NULL,
    step_order INT NOT NULL,
    approver_role_code VARCHAR(80) NOT NULL,
    approver_user_id INT NULL,
    action VARCHAR(20) NOT NULL DEFAULT 'pending',
    acted_at TIMESTAMP NULL,
    comments TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_role_code) REFERENCES roles(code) ON DELETE RESTRICT,
    FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (approval_request_id, step_order)
);

ALTER TABLE approval_steps DROP CONSTRAINT IF EXISTS approval_steps_action_check;
ALTER TABLE approval_steps
    ADD CONSTRAINT approval_steps_action_check
    CHECK (action IN ('pending', 'approved', 'rejected', 'skipped'));

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    value_text TEXT NOT NULL,
    description TEXT,
    updated_by_user_id INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO system_settings (setting_key, value_text, description)
VALUES ('major_finance_threshold_usd', '500.00', 'Expense amount threshold requiring Director final approval')
ON CONFLICT (setting_key) DO UPDATE
SET description = EXCLUDED.description;
-- =====================================================
-- 5. Role Permission Assignment
-- =====================================================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'DIRECTOR', code
FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code) VALUES
    ('FINANCE_ADMIN_OFFICER', 'user.view'),
    ('FINANCE_ADMIN_OFFICER', 'indicator.read_all'),
    ('FINANCE_ADMIN_OFFICER', 'activity.read'),
    ('FINANCE_ADMIN_OFFICER', 'expense.read'),
    ('FINANCE_ADMIN_OFFICER', 'expense.review_finance'),
    ('FINANCE_ADMIN_OFFICER', 'settings.finance_threshold.read'),
    ('FINANCE_ADMIN_OFFICER', 'approval.read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code) VALUES
    ('ADMIN_ASSISTANT', 'user.view'),
    ('ADMIN_ASSISTANT', 'user.create'),
    ('ADMIN_ASSISTANT', 'user.update'),
    ('ADMIN_ASSISTANT', 'user.assign_role'),
    ('ADMIN_ASSISTANT', 'indicator.read_all'),
    ('ADMIN_ASSISTANT', 'activity.read'),
    ('ADMIN_ASSISTANT', 'approval.read'),
    ('ADMIN_ASSISTANT', 'governance.pending_roles.read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code) VALUES
    ('LOGISTICS_ASSISTANT', 'indicator.read_assigned'),
    ('LOGISTICS_ASSISTANT', 'activity.read'),
    ('LOGISTICS_ASSISTANT', 'activity.create'),
    ('LOGISTICS_ASSISTANT', 'project.read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code) VALUES
    ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'program.read'),
    ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'project.read'),
    ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'indicator.read_assigned'),
    ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'indicator.create'),
    ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'indicator.update'),
    ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'progress.create'),
    ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'activity.read'),
    ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'activity.create'),
    ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'expense.create'),

    ('COMMUNITY_DEVELOPMENT_OFFICER', 'program.read'),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'project.read'),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'project.create'),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'project.update'),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'indicator.read_assigned'),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'indicator.create'),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'indicator.update'),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'progress.create'),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'activity.read'),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'activity.create'),
    ('COMMUNITY_DEVELOPMENT_OFFICER', 'expense.create'),

    ('ME_INTERN_ACTING_OFFICER', 'program.read'),
    ('ME_INTERN_ACTING_OFFICER', 'project.read'),
    ('ME_INTERN_ACTING_OFFICER', 'indicator.read_all'),
    ('ME_INTERN_ACTING_OFFICER', 'indicator.update'),
    ('ME_INTERN_ACTING_OFFICER', 'activity.read'),
    ('ME_INTERN_ACTING_OFFICER', 'approval.read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code) VALUES
    ('SOCIAL_SERVICES_INTERN', 'indicator.read_assigned'),
    ('SOCIAL_SERVICES_INTERN', 'progress.create'),
    ('SOCIAL_SERVICES_INTERN', 'activity.read'),
    ('SOCIAL_SERVICES_INTERN', 'volunteer.submit'),
    ('SOCIAL_SERVICES_INTERN', 'volunteer.read_own'),

    ('YOUTH_COMMUNICATIONS_INTERN', 'project.read'),
    ('YOUTH_COMMUNICATIONS_INTERN', 'activity.read'),
    ('YOUTH_COMMUNICATIONS_INTERN', 'volunteer.submit'),
    ('YOUTH_COMMUNICATIONS_INTERN', 'volunteer.read_own')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code) VALUES
    ('DEVELOPMENT_FACILITATOR', 'project.read'),
    ('DEVELOPMENT_FACILITATOR', 'activity.read'),
    ('DEVELOPMENT_FACILITATOR', 'volunteer.submit'),
    ('DEVELOPMENT_FACILITATOR', 'volunteer.read_own')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. Audit Logging
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id INT NULL,
    table_name TEXT NOT NULL,
    entity_pk TEXT,
    action TEXT NOT NULL,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION app_current_actor_id()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    raw_value TEXT;
BEGIN
    raw_value := current_setting('app.user_id', true);
    IF raw_value IS NULL OR raw_value = '' THEN
        RETURN NULL;
    END IF;
    RETURN raw_value::INT;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    pk_column TEXT;
    pk_value TEXT;
BEGIN
    pk_column := COALESCE(TG_ARGV[0], 'id');

    IF TG_OP = 'INSERT' THEN
        pk_value := COALESCE(to_jsonb(NEW) ->> pk_column, NULL);
        INSERT INTO audit_logs (actor_user_id, table_name, entity_pk, action, before_data, after_data)
        VALUES (app_current_actor_id(), TG_TABLE_NAME, pk_value, TG_OP, NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        pk_value := COALESCE(to_jsonb(NEW) ->> pk_column, to_jsonb(OLD) ->> pk_column, NULL);
        INSERT INTO audit_logs (actor_user_id, table_name, entity_pk, action, before_data, after_data)
        VALUES (app_current_actor_id(), TG_TABLE_NAME, pk_value, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        pk_value := COALESCE(to_jsonb(OLD) ->> pk_column, NULL);
        INSERT INTO audit_logs (actor_user_id, table_name, entity_pk, action, before_data, after_data)
        VALUES (app_current_actor_id(), TG_TABLE_NAME, pk_value, TG_OP, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_users_trigger ON users;
CREATE TRIGGER audit_users_trigger
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_projects_trigger ON projects;
CREATE TRIGGER audit_projects_trigger
AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_project_assignments_trigger ON project_assignments;
CREATE TRIGGER audit_project_assignments_trigger
AFTER INSERT OR UPDATE OR DELETE ON project_assignments
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_expense_requests_trigger ON expense_requests;
CREATE TRIGGER audit_expense_requests_trigger
AFTER INSERT OR UPDATE OR DELETE ON expense_requests
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_approval_requests_trigger ON approval_requests;
CREATE TRIGGER audit_approval_requests_trigger
AFTER INSERT OR UPDATE OR DELETE ON approval_requests
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_approval_steps_trigger ON approval_steps;
CREATE TRIGGER audit_approval_steps_trigger
AFTER INSERT OR UPDATE OR DELETE ON approval_steps
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_indicators_trigger ON indicators;
CREATE TRIGGER audit_indicators_trigger
AFTER INSERT OR UPDATE OR DELETE ON indicators
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_activities_trigger ON activities;
CREATE TRIGGER audit_activities_trigger
AFTER INSERT OR UPDATE OR DELETE ON activities
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
-- =====================================================
-- 7. Indexes and governance notifications
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_code ON users(role_code);
CREATE INDEX IF NOT EXISTS idx_users_role_assignment_status ON users(role_assignment_status);

CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
CREATE INDEX IF NOT EXISTS idx_projects_program_id ON projects(program_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_user_id ON projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE INDEX IF NOT EXISTS idx_indicators_created_by ON indicators(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_indicators_project_id ON indicators(project_id);
CREATE INDEX IF NOT EXISTS idx_indicators_status ON indicators(status);

CREATE INDEX IF NOT EXISTS idx_progress_updates_indicator ON progress_updates(indicator_id);
CREATE INDEX IF NOT EXISTS idx_progress_updates_approval_status ON progress_updates(approval_status);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_activities_indicator ON activities(indicator_id);
CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id);

CREATE INDEX IF NOT EXISTS idx_kobo_form_links_indicator ON kobo_form_links(indicator_id);
CREATE INDEX IF NOT EXISTS idx_kobo_submissions_indicator ON kobo_submissions(indicator_id);

CREATE INDEX IF NOT EXISTS idx_volunteer_submissions_user ON volunteer_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_participants_user ON volunteer_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_project_assignments_project_user ON project_assignments(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_expense_requests_status ON expense_requests(status);
CREATE INDEX IF NOT EXISTS idx_expense_requests_project_id ON expense_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_steps_request_order ON approval_steps(approval_request_id, step_order);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_entity ON audit_logs(table_name, entity_pk);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

INSERT INTO notifications (user_id, type, title, message, related_indicator_id)
SELECT
    director.id,
    'governance',
    'Pending Role Reassignment',
    'User ' || pending_user.name || ' (' || pending_user.email || ') requires role reassignment confirmation.',
    NULL
FROM users AS pending_user
CROSS JOIN users AS director
WHERE director.role_code = 'DIRECTOR'
  AND pending_user.role_assignment_status = 'pending_reassignment'
  AND NOT EXISTS (
      SELECT 1
      FROM notifications n
      WHERE n.user_id = director.id
        AND n.type = 'governance'
        AND n.title = 'Pending Role Reassignment'
        AND n.message = 'User ' || pending_user.name || ' (' || pending_user.email || ') requires role reassignment confirmation.'
  );
