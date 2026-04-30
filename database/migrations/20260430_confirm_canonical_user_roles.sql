UPDATE users
SET role_assignment_status = 'confirmed',
    role_confirmed_at = COALESCE(role_confirmed_at, CURRENT_TIMESTAMP)
WHERE role_code IN (
    'DIRECTOR',
    'SYSTEM_ADMIN',
    'FINANCE_ADMIN_OFFICER',
    'ADMIN_ASSISTANT',
    'LOGISTICS_ASSISTANT',
    'PSYCHOSOCIAL_SUPPORT_OFFICER',
    'COMMUNITY_DEVELOPMENT_OFFICER',
    'ME_INTERN_ACTING_OFFICER',
    'SOCIAL_SERVICES_INTERN',
    'YOUTH_COMMUNICATIONS_INTERN',
    'DEVELOPMENT_FACILITATOR'
)
AND role_assignment_status = 'pending_reassignment';
