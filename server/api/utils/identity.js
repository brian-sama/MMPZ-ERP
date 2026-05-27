const roleTitleMap = {
    DIRECTOR: 'Director',
    FINANCE_OFFICER: 'Finance Officer',
    ADMIN_FINANCE_ASSISTANT: 'Admin & Finance Assistant',
    LOGISTICS_FINANCE_ASSISTANT: 'Logistics & Finance Assistant',
    SRHR_OFFICER: 'SRHR Officer',
    PROGRAMS_ME_OFFICER: 'Programs & M&E Officer',
    MEL_OFFICER: 'MEL Officer',
    FIELD_OFFICER_1: 'Field Officer 1',
    FIELD_OFFICER_2: 'Field Officer 2',
    YOUTH_KNOWLEDGE_HUB_OFFICER: 'Youth & Knowledge Hub Officer',
    YOUTH_FACILITATOR_PEER_EDUCATOR: 'Youth Facilitator / Peer Educator',
    SYSTEM_ADMIN: 'System Administrator',
};

const departmentMap = {
    DIRECTOR: 'Executive Office',
    FINANCE_OFFICER: 'Finance & Administration',
    ADMIN_FINANCE_ASSISTANT: 'Finance & Administration',
    LOGISTICS_FINANCE_ASSISTANT: 'Finance & Administration',
    SRHR_OFFICER: 'Programmes & M&E',
    PROGRAMS_ME_OFFICER: 'Programmes & M&E',
    MEL_OFFICER: 'Programmes & M&E',
    FIELD_OFFICER_1: 'Programmes & M&E',
    FIELD_OFFICER_2: 'Programmes & M&E',
    YOUTH_KNOWLEDGE_HUB_OFFICER: 'Programmes & M&E',
    YOUTH_FACILITATOR_PEER_EDUCATOR: 'Programmes & M&E',
    SYSTEM_ADMIN: 'Administration',
};

const operationalAssignmentMap = {
    DIRECTOR: ['Strategic oversight', 'Governance approvals'],
    FINANCE_OFFICER: ['Finance review', 'Donor compliance', 'Financial reporting'],
    ADMIN_FINANCE_ASSISTANT: ['Administrative coordination', 'Finance documentation', 'Governance records', 'Staff administration', 'Liquidation support'],
    LOGISTICS_FINANCE_ASSISTANT: ['Stock coordination', 'Delivery verification', 'Asset custody', 'Vehicle logistics', 'Challenge Course equipment'],
    SRHR_OFFICER: ['SRHR technical lead', 'Case support', 'Counselling oversight'],
    PROGRAMS_ME_OFFICER: ['Community operations', 'Field supervision', 'Program coordination'],
    MEL_OFFICER: ['M&E quality assurance', 'Data validation'],
    FIELD_OFFICER_1: ['Social services follow-up', 'Field execution'],
    FIELD_OFFICER_2: ['Secondary field operations', 'Program support'],
    YOUTH_KNOWLEDGE_HUB_OFFICER: ['Youth engagement', 'Knowledge capture', 'Hub management'],
    YOUTH_FACILITATOR_PEER_EDUCATOR: ['Buddy visits', 'Defaulter tracing', 'Field peer education'],
};

export const formatIdentityLabel = (value) =>
    String(value || '')
        .split('_')
        .filter(Boolean)
        .map((part) => part[0] + part.slice(1).toLowerCase())
        .join(' ');

export const resolveDisplayTitle = (user = {}) => {
    const roleCode = user.role_code || user.roleCode;
    const configuredTitle = String(user.job_title || user.jobTitle || '').trim();
    const fallbackTitle = roleTitleMap[roleCode] || formatIdentityLabel(roleCode) || 'Team Member';

    if (!configuredTitle) return fallbackTitle;

    const inheritedFacilitatorTitle =
        /development facilitator|field implementer/i.test(configuredTitle) &&
        roleCode !== 'YOUTH_FACILITATOR_PEER_EDUCATOR';

    return inheritedFacilitatorTitle ? fallbackTitle : configuredTitle;
};

export const resolveDepartment = (user = {}) => {
    const roleCode = user.role_code || user.roleCode;
    return user.department || departmentMap[roleCode] || 'MMPZ';
};

export const resolveEmploymentType = (user = {}) => {
    const roleCode = user.role_code || user.roleCode;
    if (user.employment_type || user.employmentType) return user.employment_type || user.employmentType;
    if (String(roleCode || '').includes('INTERN')) return 'INTERN';
    if (roleCode === 'YOUTH_FACILITATOR_PEER_EDUCATOR') return 'VOLUNTEER';
    return 'STAFF';
};

export const buildIdentity = (user = {}, options = {}) => {
    const roleCode = user.role_code || user.roleCode;
    const systemRole = options.systemRole || user.system_role || user.systemRole;
    const displayTitle = resolveDisplayTitle(user);
    const department = resolveDepartment(user);

    return {
        displayName: user.name || user.email || 'MMPZ User',
        displayTitle,
        department,
        supervisor: null,
        employmentType: resolveEmploymentType(user),
        systemRoles: [systemRole, roleCode].filter(Boolean).map(formatIdentityLabel),
        operationalAssignments: operationalAssignmentMap[roleCode] || [],
    };
};
