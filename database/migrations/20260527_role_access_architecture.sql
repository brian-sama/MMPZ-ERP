-- Migration: role access architecture and logistics coordination dashboard permissions
-- Adds ABAC profile scaffolding, access event logging, and tightens the
-- Admin & Finance Assistant role into an operational logistics role.

INSERT INTO permissions (code, description)
VALUES
    ('operations.logistics_dashboard.read', 'View the operational logistics coordination dashboard'),
    ('operations.stock.minor_issue.approve', 'Approve routine stock issuance within operational limits'),
    ('operations.delivery.verify', 'Verify deliveries and delivery-note condition records'),
    ('operations.asset.return.verify', 'Verify asset returns and custody close-out records'),
    ('operations.liquidation.support', 'Support liquidation document completeness and receipt reconciliation'),
    ('operations.procurement.prepare', 'Prepare procurement records and supplier evidence without final approval'),
    ('access.audit.read', 'View access-event audit records'),
    ('access.profile.manage', 'Manage user and role access profile attributes')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

UPDATE roles
SET
    name = 'Operational Logistics & Accountability Coordinator',
    description = 'Operational coordination role for stock, delivery notes, assets, procurement evidence, liquidation support, and field logistics.'
WHERE code = 'ADMIN_FINANCE_ASSISTANT';

INSERT INTO role_permissions (role_code, permission_code)
SELECT 'DIRECTOR', code
FROM permissions
WHERE code IN (
    'operations.logistics_dashboard.read',
    'operations.stock.minor_issue.approve',
    'operations.delivery.verify',
    'operations.asset.return.verify',
    'operations.liquidation.support',
    'operations.procurement.prepare',
    'access.audit.read',
    'access.profile.manage'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code)
SELECT 'SYSTEM_ADMIN', code
FROM permissions
WHERE code IN (
    'operations.logistics_dashboard.read',
    'operations.stock.minor_issue.approve',
    'operations.delivery.verify',
    'operations.asset.return.verify',
    'operations.liquidation.support',
    'operations.procurement.prepare',
    'access.audit.read',
    'access.profile.manage'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code) VALUES
    ('FINANCE_OFFICER', 'operations.logistics_dashboard.read'),
    ('FINANCE_OFFICER', 'operations.delivery.verify'),
    ('FINANCE_OFFICER', 'operations.liquidation.support'),
    ('FINANCE_OFFICER', 'operations.procurement.prepare'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.logistics_dashboard.read'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.stock.minor_issue.approve'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.delivery.verify'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.asset.return.verify'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.liquidation.support'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.procurement.prepare')
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions
WHERE role_code = 'ADMIN_FINANCE_ASSISTANT'
  AND permission_code IN ('operations.compliance.manage', 'operations.confidential.read', 'operations.confidential.manage');

CREATE TABLE IF NOT EXISTS role_access_profiles (
    role_code VARCHAR(80) PRIMARY KEY REFERENCES roles(code) ON DELETE CASCADE,
    organizational_unit TEXT NOT NULL,
    functional_access JSONB NOT NULL DEFAULT '[]'::jsonb,
    sensitivity_clearance VARCHAR(40) NOT NULL DEFAULT 'internal' CHECK (
        sensitivity_clearance IN ('public', 'internal', 'confidential', 'safeguarding', 'executive_only')
    ),
    operational_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    approval_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    restrictions JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO role_access_profiles (
    role_code,
    organizational_unit,
    functional_access,
    sensitivity_clearance,
    operational_scope,
    approval_scope,
    restrictions
)
VALUES
    (
        'DIRECTOR',
        'Executive Office',
        '["governance","finance_summary","procurement","compliance","stock_analytics","assets","confidential","strategic_dashboards"]'::jsonb,
        'executive_only',
        '{"districts":"all","programs":"all","activities":"read_only"}'::jsonb,
        '{"strategic_budgets":true,"major_procurement":true,"confidential_records":true}'::jsonb,
        '["no_raw_field_data_edit","no_counselling_note_mutation","no_liquidation_mutation_by_default"]'::jsonb
    ),
    (
        'FINANCE_OFFICER',
        'Finance & Administration',
        '["budgets","funding_requests","quotations","receipts","procurement","delivery_notes","stock","assets","liquidations","compliance"]'::jsonb,
        'confidential',
        '{"districts":"all","programs":"finance_visible","activities":"finance_visible"}'::jsonb,
        '{"financial_review":true,"major_procurement":"threshold_controlled","liquidation_verification":true}'::jsonb,
        '["no_counselling_notes","no_psychosocial_case_details","no_viral_load_records"]'::jsonb
    ),
    (
        'ADMIN_FINANCE_ASSISTANT',
        'Finance & Administration',
        '["stock_management","delivery_notes","procurement_evidence","receipts","asset_checkouts","liquidation_support","field_logistics","challenge_course_logistics"]'::jsonb,
        'internal',
        '{"districts":"operations_assigned","programs":"operations_visible","activities":"logistics_related"}'::jsonb,
        '{"minor_stock_issuance":true,"delivery_verification":true,"asset_returns":true,"major_procurement":false,"strategic_budgets":false}'::jsonb,
        '["no_executive_confidential","no_sensitive_cases","no_beneficiary_counselling_notes","no_viral_load_records","no_large_procurement_approval"]'::jsonb
    ),
    (
        'PROGRAMS_ME_OFFICER',
        'Programmes & M&E',
        '["activity_planning","operational_budgets","assignments","approvals","logistics_requests","stock_requests","m_and_e","qa","cases","referrals"]'::jsonb,
        'confidential',
        '{"districts":"all_program_districts","programs":"all_programs","activities":"program_control"}'::jsonb,
        '{"program_approvals":true,"stock_requests":true}'::jsonb,
        '["no_executive_confidential","no_payroll","no_board_governance_documents"]'::jsonb
    ),
    (
        'MEL_OFFICER',
        'Programmes & M&E',
        '["indicators","reporting","dashboards","qa_review","dqa","data_validation","analytics","activity_records"]'::jsonb,
        'internal',
        '{"districts":"m_and_e_visible","programs":"m_and_e_visible","activities":"read_review"}'::jsonb,
        '{"data_quality_review":true}'::jsonb,
        '["no_payroll","no_confidential_hr","no_sensitive_counselling_notes_by_default"]'::jsonb
    ),
    (
        'FIELD_OFFICER_1',
        'Programmes & M&E',
        '["assigned_activities","stock_requests","logistics_requests","challenge_course","participant_capture","evidence"]'::jsonb,
        'internal',
        '{"districts":"assigned_only","programs":["SRHR","Challenge Course"],"activities":"assigned_only"}'::jsonb,
        '{"field_submission":true}'::jsonb,
        '["no_finance_approval","no_procurement_approval","no_executive_section"]'::jsonb
    ),
    (
        'FIELD_OFFICER_2',
        'Programmes & M&E',
        '["assigned_cases","counselling","case_management","buddy_system","viral_load_monitoring","defaulter_tracing","referrals"]'::jsonb,
        'safeguarding',
        '{"districts":"assigned_only","programs":["PSS","HIV","Parenting"],"activities":"assigned_only"}'::jsonb,
        '{"case_follow_up":true}'::jsonb,
        '["no_finance","no_procurement","no_board_governance"]'::jsonb
    ),
    (
        'SRHR_OFFICER',
        'Programmes & M&E',
        '["srhr_cases","referrals","adolescent_records","outreach_reports","mobile_srhr_forms"]'::jsonb,
        'confidential',
        '{"districts":"srhr_visible","programs":["SRHR"],"activities":"srhr_related"}'::jsonb,
        '{"srhr_review":true}'::jsonb,
        '["no_executive_confidential","no_payroll"]'::jsonb
    ),
    (
        'YOUTH_KNOWLEDGE_HUB_OFFICER',
        'Programmes & M&E',
        '["knowledge_hub","learning_reports","case_studies","organizational_history","communications","documentation"]'::jsonb,
        'internal',
        '{"districts":"knowledge_hub_visible","programs":"knowledge_hub_visible","activities":"documentation_related"}'::jsonb,
        '{"documentation_review":true}'::jsonb,
        '["no_sensitive_hiv_case_details","no_safeguarding_records","no_payroll"]'::jsonb
    ),
    (
        'YOUTH_FACILITATOR_PEER_EDUCATOR',
        'Programmes & M&E',
        '["assigned_outreach","attendance","buddy_checkins","simple_reporting","referrals"]'::jsonb,
        'internal',
        '{"districts":"assigned_only","programs":"assigned_only","activities":"assigned_only"}'::jsonb,
        '{"field_submission":true}'::jsonb,
        '["no_counselling_notes","no_viral_load_data","no_safeguarding_files","no_finance","no_procurement","no_confidential_area"]'::jsonb
    ),
    (
        'SYSTEM_ADMIN',
        'Administration',
        '["system_configuration","users","roles","access_profiles","audit","all_modules_for_support"]'::jsonb,
        'executive_only',
        '{"districts":"all","programs":"all","activities":"all"}'::jsonb,
        '{"system_admin":true}'::jsonb,
        '["technical_access_must_be_audited"]'::jsonb
    )
ON CONFLICT (role_code) DO UPDATE
SET
    organizational_unit = EXCLUDED.organizational_unit,
    functional_access = EXCLUDED.functional_access,
    sensitivity_clearance = EXCLUDED.sensitivity_clearance,
    operational_scope = EXCLUDED.operational_scope,
    approval_scope = EXCLUDED.approval_scope,
    restrictions = EXCLUDED.restrictions,
    updated_at = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS user_access_profiles (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organizational_unit TEXT,
    sensitivity_clearance VARCHAR(40) CHECK (
        sensitivity_clearance IN ('public', 'internal', 'confidential', 'safeguarding', 'executive_only')
    ),
    district_scope TEXT[] DEFAULT NULL,
    program_scope UUID[] DEFAULT NULL,
    activity_scope INT[] DEFAULT NULL,
    approval_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    restrictions JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    module_code TEXT,
    entity_type TEXT,
    entity_id TEXT,
    sensitivity_level VARCHAR(40) NOT NULL DEFAULT 'internal' CHECK (
        sensitivity_level IN ('public', 'internal', 'confidential', 'safeguarding', 'executive_only')
    ),
    organizational_unit TEXT,
    district_code TEXT,
    program_id UUID NULL REFERENCES programs(id) ON DELETE SET NULL,
    activity_id INT NULL REFERENCES activities(id) ON DELETE SET NULL,
    outcome VARCHAR(30) NOT NULL DEFAULT 'allowed' CHECK (outcome IN ('allowed', 'denied', 'error')),
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_access_events_actor_created ON access_events(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_module_created ON access_events(module_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_sensitivity ON access_events(sensitivity_level, created_at DESC);

DROP TRIGGER IF EXISTS audit_role_access_profiles_trigger ON role_access_profiles;
CREATE TRIGGER audit_role_access_profiles_trigger
AFTER INSERT OR UPDATE OR DELETE ON role_access_profiles
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('role_code');

DROP TRIGGER IF EXISTS audit_user_access_profiles_trigger ON user_access_profiles;
CREATE TRIGGER audit_user_access_profiles_trigger
AFTER INSERT OR UPDATE OR DELETE ON user_access_profiles
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('user_id');
