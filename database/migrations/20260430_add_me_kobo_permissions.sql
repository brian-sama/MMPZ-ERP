-- Allow M&E-facing program roles to manage and sync KoBo form links from
-- the Monitoring & Evaluation workspace.

INSERT INTO role_permissions (role_code, permission_code)
SELECT requested.role_code, requested.permission_code
FROM (
    VALUES
        ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'kobo.manage'),
        ('PSYCHOSOCIAL_SUPPORT_OFFICER', 'kobo.sync'),
        ('COMMUNITY_DEVELOPMENT_OFFICER', 'kobo.manage'),
        ('COMMUNITY_DEVELOPMENT_OFFICER', 'kobo.sync'),
        ('ME_INTERN_ACTING_OFFICER', 'kobo.manage'),
        ('ME_INTERN_ACTING_OFFICER', 'kobo.sync'),
        ('SOCIAL_SERVICES_INTERN', 'kobo.manage'),
        ('SOCIAL_SERVICES_INTERN', 'kobo.sync'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'kobo.manage'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'kobo.sync')
) AS requested(role_code, permission_code)
JOIN roles r ON r.code = requested.role_code
JOIN permissions p ON p.code = requested.permission_code
ON CONFLICT DO NOTHING;
