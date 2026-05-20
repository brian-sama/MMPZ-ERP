export const ROLE_TO_SYSTEM_ROLE = {
  DIRECTOR: 'MANAGEMENT',
  FINANCE_OFFICER: 'PROGRAM_STAFF',
  ADMIN_FINANCE_ASSISTANT: 'OPERATIONS',
  SRHR_OFFICER: 'PROGRAM_STAFF',
  PROGRAMS_ME_OFFICER: 'PROGRAM_STAFF',
  MEL_OFFICER: 'INTERN',
  FIELD_OFFICER_1: 'INTERN',
  FIELD_OFFICER_2: 'INTERN',
  YOUTH_KNOWLEDGE_HUB_OFFICER: 'INTERN',
  YOUTH_FACILITATOR_PEER_EDUCATOR: 'FACILITATOR',
  SYSTEM_ADMIN: 'SUPER_ADMIN',
};

const ROLE_LANDING_PAGES = {
  DIRECTOR: '/dashboard',
  FINANCE_OFFICER: '/finance',
  ADMIN_FINANCE_ASSISTANT: '/settings',
  SRHR_OFFICER: '/programs',
  PROGRAMS_ME_OFFICER: '/programs',
  MEL_OFFICER: '/me',
  FIELD_OFFICER_1: '/programs',
  FIELD_OFFICER_2: '/programs',
  YOUTH_KNOWLEDGE_HUB_OFFICER: '/programs',
  YOUTH_FACILITATOR_PEER_EDUCATOR: '/my-portal',
  SYSTEM_ADMIN: '/dashboard',
};

export const resolveSystemRole = (roleCode, fallbackSystemRole = null) =>
  fallbackSystemRole || ROLE_TO_SYSTEM_ROLE[roleCode] || 'INTERN';

export const formatRoleLabel = (value) =>
  String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(' ');

const DISPLAY_TITLE_BY_ROLE = {
  DIRECTOR: 'Director',
  FINANCE_OFFICER: 'Finance Officer',
  ADMIN_FINANCE_ASSISTANT: 'Admin & Finance Assistant',
  SRHR_OFFICER: 'SRHR Officer',
  PROGRAMS_ME_OFFICER: 'Programs & M&E Officer',
  MEL_OFFICER: 'MEL Officer',
  FIELD_OFFICER_1: 'Field Officer 1',
  FIELD_OFFICER_2: 'Field Officer 2',
  YOUTH_KNOWLEDGE_HUB_OFFICER: 'Youth & Knowledge Hub Officer',
  YOUTH_FACILITATOR_PEER_EDUCATOR: 'Youth Facilitator / Peer Educator',
  SYSTEM_ADMIN: 'System Administrator',
};

const DEPARTMENT_BY_ROLE = {
  DIRECTOR: 'Executive Office',
  FINANCE_OFFICER: 'Finance & Administration',
  ADMIN_FINANCE_ASSISTANT: 'Finance & Administration',
  SRHR_OFFICER: 'Programmes & M&E',
  PROGRAMS_ME_OFFICER: 'Programmes & M&E',
  MEL_OFFICER: 'Programmes & M&E',
  FIELD_OFFICER_1: 'Programmes & M&E',
  FIELD_OFFICER_2: 'Programmes & M&E',
  YOUTH_KNOWLEDGE_HUB_OFFICER: 'Programmes & M&E',
  YOUTH_FACILITATOR_PEER_EDUCATOR: 'Programmes & M&E',
  SYSTEM_ADMIN: 'Administration',
};

const resolveDisplayTitle = (user, roleCode) => {
  const configuredTitle = String(user.job_title || user.title || '').trim();
  const fallbackTitle = DISPLAY_TITLE_BY_ROLE[roleCode] || formatRoleLabel(roleCode) || 'Team Member';
  const inheritedFacilitatorTitle =
    /development facilitator|field implementer/i.test(configuredTitle) &&
    roleCode !== 'YOUTH_FACILITATOR_PEER_EDUCATOR';

  if (!configuredTitle || inheritedFacilitatorTitle) return fallbackTitle;
  return configuredTitle;
};

const resolveEmploymentType = (roleCode, user) => {
  if (user.employment_type || user.employmentType) return user.employment_type || user.employmentType;
  if (String(roleCode || '').includes('INTERN')) return 'INTERN';
  if (roleCode === 'YOUTH_FACILITATOR_PEER_EDUCATOR') return 'VOLUNTEER';
  return 'STAFF';
};

export const normalizeUserProfile = (user) => {
  if (!user) return null;
  const roleCode = user.role_code || null;
  const systemRole = resolveSystemRole(roleCode, user.system_role);
  const displayTitle = user.identity?.displayTitle || resolveDisplayTitle(user, roleCode);
  const department = user.identity?.department || user.department || DEPARTMENT_BY_ROLE[roleCode] || 'MMPZ';
  const employmentType = user.identity?.employmentType || resolveEmploymentType(roleCode, user);
  return {
    ...user,
    role_code: roleCode,
    system_role: systemRole,
    job_title: displayTitle,
    department,
    employment_type: employmentType,
    identity: {
      displayName: user.name || user.email || 'MMPZ User',
      displayTitle,
      department,
      supervisor: user.identity?.supervisor || null,
      employmentType,
      systemRoles:
        user.identity?.systemRoles ||
        [systemRole, roleCode].filter(Boolean).map((value) => formatRoleLabel(value)),
      operationalAssignments: user.identity?.operationalAssignments || [],
    },
  };
};

export const canAccessRole = (user, allowedRoles) => {
  if (user?.system_role === 'SUPER_ADMIN') return true;
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(user?.role_code);
};

export const getDefaultRouteForUser = (user) => {
  if (!user?.role_code) return '/dashboard';
  return ROLE_LANDING_PAGES[user.role_code] || '/dashboard';
};
