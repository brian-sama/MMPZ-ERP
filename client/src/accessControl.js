export const ROLE_TO_SYSTEM_ROLE = {
  DIRECTOR: 'MANAGEMENT',
  FINANCE_ADMIN_OFFICER: 'PROGRAM_STAFF',
  ADMIN_ASSISTANT: 'OPERATIONS',
  LOGISTICS_ASSISTANT: 'OPERATIONS',
  PSYCHOSOCIAL_SUPPORT_OFFICER: 'PROGRAM_STAFF',
  COMMUNITY_DEVELOPMENT_OFFICER: 'PROGRAM_STAFF',
  ME_INTERN_ACTING_OFFICER: 'INTERN',
  SOCIAL_SERVICES_INTERN: 'INTERN',
  YOUTH_COMMUNICATIONS_INTERN: 'INTERN',
  DEVELOPMENT_FACILITATOR: 'FACILITATOR',
  SYSTEM_ADMIN: 'SUPER_ADMIN',
};

const ROLE_LANDING_PAGES = {
  DIRECTOR: '/dashboard',
  FINANCE_ADMIN_OFFICER: '/finance',
  ADMIN_ASSISTANT: '/settings',
  LOGISTICS_ASSISTANT: '/finance',
  PSYCHOSOCIAL_SUPPORT_OFFICER: '/programs',
  COMMUNITY_DEVELOPMENT_OFFICER: '/programs',
  ME_INTERN_ACTING_OFFICER: '/me',
  SOCIAL_SERVICES_INTERN: '/my-portal',
  YOUTH_COMMUNICATIONS_INTERN: '/my-portal',
  DEVELOPMENT_FACILITATOR: '/my-portal',
};

export const resolveSystemRole = (roleCode, fallbackSystemRole = null) =>
  fallbackSystemRole || ROLE_TO_SYSTEM_ROLE[roleCode] || 'INTERN';

export const formatRoleLabel = (value) =>
  String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(' ');

export const normalizeUserProfile = (user) => {
  if (!user) return null;
  const roleCode = user.role_code || null;
  const systemRole = resolveSystemRole(roleCode, user.system_role);
  return {
    ...user,
    role_code: roleCode,
    system_role: systemRole,
    job_title: user.job_title || formatRoleLabel(roleCode) || 'Team Member',
  };
};

export const canAccessRole = (user, allowedRoles) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(user?.role_code);
};

export const getDefaultRouteForUser = (user) => {
  if (!user?.role_code) return '/dashboard';
  return ROLE_LANDING_PAGES[user.role_code] || '/dashboard';
};
