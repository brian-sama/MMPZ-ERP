-- Migration: split Admin & Finance Assistant from Logistics & Finance Assistant
-- Keeps administrative/documentation support separate from physical logistics,
-- inventory, assets, delivery verification, and field distribution custody.

INSERT INTO roles (code, name, description, is_executive)
VALUES
    (
        'ADMIN_FINANCE_ASSISTANT',
        'Admin & Finance Assistant',
        'Administrative operations, finance documentation, governance support, records coordination, scheduling, and internal administration.',
        FALSE
    ),
    (
        'LOGISTICS_FINANCE_ASSISTANT',
        'Logistics & Finance Assistant',
        'Operational logistics, inventory, delivery notes, assets, vehicles, warehouse records, procurement logistics, and field distribution coordination.',
        FALSE
    )
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_executive = EXCLUDED.is_executive;

INSERT INTO permissions (code, description)
VALUES
    ('operations.admin_dashboard.read', 'View administrative operations and financial documentation dashboard'),
    ('operations.governance_documents.upload', 'Upload and organize governance support documents without executive investigation access'),
    ('operations.hr_documents.support', 'Support staff administration documents without payroll or confidential HR decision access')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_code, permission_code)
SELECT role_code, permission_code
FROM (
    VALUES
        ('DIRECTOR', 'operations.admin_dashboard.read'),
        ('DIRECTOR', 'operations.governance_documents.upload'),
        ('DIRECTOR', 'operations.hr_documents.support'),
        ('SYSTEM_ADMIN', 'operations.admin_dashboard.read'),
        ('SYSTEM_ADMIN', 'operations.governance_documents.upload'),
        ('SYSTEM_ADMIN', 'operations.hr_documents.support'),
        ('FINANCE_OFFICER', 'operations.admin_dashboard.read'),
        ('FINANCE_OFFICER', 'operations.governance_documents.upload'),
        ('FINANCE_OFFICER', 'operations.hr_documents.support'),
        ('ADMIN_FINANCE_ASSISTANT', 'operations.admin_dashboard.read'),
        ('ADMIN_FINANCE_ASSISTANT', 'operations.compliance.read'),
        ('ADMIN_FINANCE_ASSISTANT', 'operations.compliance.manage'),
        ('ADMIN_FINANCE_ASSISTANT', 'operations.governance_documents.upload'),
        ('ADMIN_FINANCE_ASSISTANT', 'operations.hr_documents.support'),
        ('ADMIN_FINANCE_ASSISTANT', 'operations.procurement_evidence.manage'),
        ('ADMIN_FINANCE_ASSISTANT', 'operations.procurement.prepare'),
        ('ADMIN_FINANCE_ASSISTANT', 'operations.liquidation.support'),
        ('ADMIN_FINANCE_ASSISTANT', 'operations.inventory.read'),
        ('ADMIN_FINANCE_ASSISTANT', 'operations.assets.read'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.logistics_dashboard.read'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.inventory.read'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.inventory.request'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.inventory.manage'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.stock.minor_issue.approve'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.delivery.verify'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.assets.read'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.assets.checkout'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.assets.manage'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.asset.return.verify'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.procurement_evidence.manage'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.procurement.prepare'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.liquidation.support'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.challenge_course.read'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'operations.challenge_course.manage'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'activity.read'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'approval.read'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'project.read'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'volunteer.submit'),
        ('LOGISTICS_FINANCE_ASSISTANT', 'volunteer.read_own')
) AS requested(role_code, permission_code)
JOIN roles r ON r.code = requested.role_code
JOIN permissions p ON p.code = requested.permission_code
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions
WHERE role_code = 'ADMIN_FINANCE_ASSISTANT'
  AND permission_code IN (
      'operations.logistics_dashboard.read',
      'operations.inventory.manage',
      'operations.stock.minor_issue.approve',
      'operations.delivery.verify',
      'operations.assets.checkout',
      'operations.assets.manage',
      'operations.asset.return.verify',
      'operations.challenge_course.manage',
      'operations.confidential.read',
      'operations.confidential.manage'
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
        'ADMIN_FINANCE_ASSISTANT',
        'Finance & Administration',
        '["administrative_operations","finance_uploads","payment_documentation","quotations","liquidation_support","compliance_records","pvo_documents","policy_records","board_meeting_records","staff_administration","request_for_funds_administration"]'::jsonb,
        'confidential',
        '{"districts":"organization_admin","programs":"administrative_visible","activities":"documentation_related"}'::jsonb,
        '{"request_for_funds_preparation":true,"compliance_uploads":true,"board_document_organization":true,"minor_stock_issuance":false,"delivery_verification":false,"asset_checkouts":false,"major_procurement":false,"strategic_budgets":false}'::jsonb,
        '["no_warehouse_management","no_stock_issuing","no_delivery_verification","no_asset_custody_control","no_sensitive_investigations_without_authorization","no_beneficiary_counselling_notes","no_viral_load_records","no_payroll_approval"]'::jsonb
    ),
    (
        'LOGISTICS_FINANCE_ASSISTANT',
        'Finance & Administration',
        '["stock_management","delivery_notes","procurement_logistics","supplier_delivery_tracking","asset_checkouts","vehicle_tracking","warehouse_records","field_logistics","challenge_course_equipment","stock_checks"]'::jsonb,
        'internal',
        '{"districts":"operations_assigned","programs":"logistics_visible","activities":"materials_assets_transport_related"}'::jsonb,
        '{"minor_stock_issuance":true,"delivery_verification":true,"asset_returns":true,"vehicle_logistics":true,"challenge_course_equipment_issuance":true,"major_procurement":false,"strategic_budgets":false,"governance_records":false}'::jsonb,
        '["no_governance_documents","no_board_documents","no_hr_files","no_executive_confidential","no_sensitive_cases","no_beneficiary_counselling_notes","no_viral_load_records","no_large_procurement_approval"]'::jsonb
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

UPDATE users
SET
    name = CASE
        WHEN email = 'admin.assistant@mmpz.org' THEN 'Admin & Finance Assistant'
        ELSE name
    END,
    role_code = 'ADMIN_FINANCE_ASSISTANT',
    system_role = 'OPERATIONS',
    job_title = 'Admin & Finance Assistant',
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'admin.assistant@mmpz.org';

INSERT INTO users (
    name,
    email,
    role_code,
    system_role,
    job_title,
    password_hash,
    require_password_reset,
    role_assignment_status,
    role_confirmed_at,
    role_legacy_snapshot
)
VALUES (
    'Logistics & Finance Assistant',
    'logistics.assistant@mmpz.org',
    'LOGISTICS_FINANCE_ASSISTANT',
    'OPERATIONS',
    'Logistics & Finance Assistant',
    crypt('Mmpz@123', gen_salt('bf')),
    FALSE,
    'pending_reassignment',
    NULL,
    'logistics_assistant'
)
ON CONFLICT (email) DO UPDATE
SET
    role_code = EXCLUDED.role_code,
    system_role = EXCLUDED.system_role,
    job_title = EXCLUDED.job_title,
    updated_at = CURRENT_TIMESTAMP;
