-- Align Social Services and Youth/Communications interns with program officer access.
-- These roles should have the same functional permissions as Community Development
-- and Psychosocial Support Officers while keeping their canonical job titles.

INSERT INTO role_permissions (role_code, permission_code)
SELECT requested.role_code, requested.permission_code
FROM (
    VALUES
        ('SOCIAL_SERVICES_INTERN', 'program.read'),
        ('SOCIAL_SERVICES_INTERN', 'project.read'),
        ('SOCIAL_SERVICES_INTERN', 'project.create'),
        ('SOCIAL_SERVICES_INTERN', 'project.update'),
        ('SOCIAL_SERVICES_INTERN', 'indicator.read_assigned'),
        ('SOCIAL_SERVICES_INTERN', 'indicator.create'),
        ('SOCIAL_SERVICES_INTERN', 'indicator.update'),
        ('SOCIAL_SERVICES_INTERN', 'progress.create'),
        ('SOCIAL_SERVICES_INTERN', 'activity.read'),
        ('SOCIAL_SERVICES_INTERN', 'activity.create'),
        ('SOCIAL_SERVICES_INTERN', 'expense.create'),
        ('SOCIAL_SERVICES_INTERN', 'volunteer.submit'),
        ('SOCIAL_SERVICES_INTERN', 'volunteer.read_own'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'program.read'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'project.read'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'project.create'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'project.update'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'indicator.read_assigned'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'indicator.create'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'indicator.update'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'progress.create'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'activity.read'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'activity.create'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'expense.create'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'volunteer.submit'),
        ('YOUTH_COMMUNICATIONS_INTERN', 'volunteer.read_own')
) AS requested(role_code, permission_code)
JOIN roles r ON r.code = requested.role_code
JOIN permissions p ON p.code = requested.permission_code
ON CONFLICT DO NOTHING;
