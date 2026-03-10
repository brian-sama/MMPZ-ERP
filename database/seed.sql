-- MMPZ ERP Canonical Seed Data
-- Password for seeded users: Mmpz@123

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (
    name,
    email,
    role_code,
    password_hash,
    require_password_reset,
    role_assignment_status,
    role_confirmed_at,
    role_legacy_snapshot
)
VALUES
    (
        'Brian Magagula',
        'brianmagagula5@gmail.com',
        'DIRECTOR',
        crypt('Brian7350$@#', gen_salt('bf')),
        FALSE,
        'confirmed',
        CURRENT_TIMESTAMP,
        'director'
    ),
    (
        'Finance and Admin Officer',
        'finance@mmpz.org',
        'FINANCE_ADMIN_OFFICER',
        crypt('Mmpz@123', gen_salt('bf')),
        FALSE,
        'pending_reassignment',
        NULL,
        'officer'
    ),
    (
        'Admin Assistant',
        'admin.assistant@mmpz.org',
        'ADMIN_ASSISTANT',
        crypt('Mmpz@123', gen_salt('bf')),
        FALSE,
        'pending_reassignment',
        NULL,
        'officer'
    ),
    (
        'Community Development Officer',
        'community.officer@mmpz.org',
        'COMMUNITY_DEVELOPMENT_OFFICER',
        crypt('Mmpz@123', gen_salt('bf')),
        FALSE,
        'pending_reassignment',
        NULL,
        'officer'
    ),
    (
        'Development Facilitator',
        'facilitator@mmpz.org',
        'DEVELOPMENT_FACILITATOR',
        crypt('Mmpz@123', gen_salt('bf')),
        FALSE,
        'pending_reassignment',
        NULL,
        'volunteer'
    )
ON CONFLICT (email) DO UPDATE
SET
    name = EXCLUDED.name,
    role_code = EXCLUDED.role_code,
    password_hash = EXCLUDED.password_hash,
    require_password_reset = EXCLUDED.require_password_reset,
    role_assignment_status = EXCLUDED.role_assignment_status,
    role_confirmed_at = EXCLUDED.role_confirmed_at,
    role_legacy_snapshot = EXCLUDED.role_legacy_snapshot;

INSERT INTO programs (name, description, status, created_by_user_id)
SELECT
    'Youth Empowerment Program',
    'Core program for youth development and inclusion activities',
    'active',
    u.id
FROM users u
WHERE u.email = 'brianmagagula5@gmail.com'
  AND NOT EXISTS (
      SELECT 1 FROM programs p WHERE p.name = 'Youth Empowerment Program'
  )
LIMIT 1;

INSERT INTO projects (
    program_id,
    name,
    description,
    donor,
    start_date,
    end_date,
    status,
    owner_user_id
)
SELECT
    p.id,
    'Digital Literacy and Community Outreach',
    'Community digital literacy training and psychosocial outreach support',
    'MMPZ Core Fund',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '180 days',
    'active',
    o.id
FROM programs p
JOIN users o ON o.email = 'community.officer@mmpz.org'
WHERE p.name = 'Youth Empowerment Program'
  AND NOT EXISTS (
      SELECT 1
      FROM projects pr
      WHERE pr.name = 'Digital Literacy and Community Outreach'
  )
LIMIT 1;

INSERT INTO indicators (
    project_id,
    title,
    target_value,
    current_value,
    total_budget,
    current_budget_balance,
    created_by_user_id,
    status,
    priority,
    reporting_period_start,
    reporting_period_end
)
SELECT
    pr.id,
    'Youth Trained in Digital Skills',
    500,
    0,
    5000.00,
    5000.00,
    d.id,
    'active',
    'high',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '180 days'
FROM projects pr
JOIN users d ON d.email = 'brianmagagula5@gmail.com'
WHERE pr.name = 'Digital Literacy and Community Outreach'
  AND NOT EXISTS (
      SELECT 1 FROM indicators i WHERE i.title = 'Youth Trained in Digital Skills'
  )
LIMIT 1;

INSERT INTO notifications (user_id, type, title, message)
SELECT
    u.id,
    'system',
    'Welcome to MMPZ ERP',
    'Your account is ready. Please review your pending governance tasks.'
FROM users u
WHERE NOT EXISTS (
    SELECT 1
    FROM notifications n
    WHERE n.user_id = u.id
      AND n.title = 'Welcome to MMPZ ERP'
);

INSERT INTO kobo_config (server_url, api_token, is_connected)
SELECT 'https://kf.kobotoolbox.org', '', FALSE
WHERE NOT EXISTS (SELECT 1 FROM kobo_config);

INSERT INTO system_settings (setting_key, value_text, description)
VALUES ('major_finance_threshold_usd', '500.00', 'Expense amount threshold requiring Director final approval')
ON CONFLICT (setting_key) DO UPDATE
SET value_text = EXCLUDED.value_text;
