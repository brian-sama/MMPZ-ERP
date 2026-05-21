import { sql } from './db.js';
import {
    getBearerTokenFromHeaders,
    verifySessionToken,
} from './session-token.js';
import { buildIdentity } from './identity.js';

export class HttpError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}

export const ROLE_CODES = [
    'DIRECTOR',
    'FINANCE_OFFICER',
    'ADMIN_FINANCE_ASSISTANT',
    'SRHR_OFFICER',
    'PROGRAMS_ME_OFFICER',
    'MEL_OFFICER',
    'FIELD_OFFICER_1',
    'FIELD_OFFICER_2',
    'YOUTH_KNOWLEDGE_HUB_OFFICER',
    'YOUTH_FACILITATOR_PEER_EDUCATOR',
    'SYSTEM_ADMIN',
];

const legacyRoleMap = {
    DIRECTOR: 'admin',
    FINANCE_OFFICER: 'officer',
    ADMIN_FINANCE_ASSISTANT: 'admin',
    SRHR_OFFICER: 'officer',
    PROGRAMS_ME_OFFICER: 'officer',
    MEL_OFFICER: 'officer',
    FIELD_OFFICER_1: 'intern',
    FIELD_OFFICER_2: 'intern',
    YOUTH_KNOWLEDGE_HUB_OFFICER: 'intern',
    YOUTH_FACILITATOR_PEER_EDUCATOR: 'volunteer',
};

const legacyToCanonicalMap = {
    admin: 'ADMIN_FINANCE_ASSISTANT',
    director: 'DIRECTOR',
    officer: 'PROGRAMS_ME_OFFICER',
    intern: 'FIELD_OFFICER_1',
    volunteer: 'YOUTH_FACILITATOR_PEER_EDUCATOR',
};

export const SYSTEM_ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    MANAGEMENT: 'MANAGEMENT',
    PROGRAM_STAFF: 'PROGRAM_STAFF',
    OPERATIONS: 'OPERATIONS',
    INTERN: 'INTERN',
    FACILITATOR: 'FACILITATOR'
};

export const ROLE_TO_SYSTEM_ROLE = {
    DIRECTOR: SYSTEM_ROLES.MANAGEMENT,
    FINANCE_OFFICER: SYSTEM_ROLES.PROGRAM_STAFF,
    ADMIN_FINANCE_ASSISTANT: SYSTEM_ROLES.OPERATIONS,
    SRHR_OFFICER: SYSTEM_ROLES.PROGRAM_STAFF,
    PROGRAMS_ME_OFFICER: SYSTEM_ROLES.PROGRAM_STAFF,
    MEL_OFFICER: SYSTEM_ROLES.INTERN,
    FIELD_OFFICER_1: SYSTEM_ROLES.INTERN,
    FIELD_OFFICER_2: SYSTEM_ROLES.INTERN,
    YOUTH_KNOWLEDGE_HUB_OFFICER: SYSTEM_ROLES.INTERN,
    YOUTH_FACILITATOR_PEER_EDUCATOR: SYSTEM_ROLES.FACILITATOR,
    SYSTEM_ADMIN: SYSTEM_ROLES.SUPER_ADMIN,
};

const systemRoleToLegacy = {
    [SYSTEM_ROLES.SUPER_ADMIN]: 'admin',
    [SYSTEM_ROLES.MANAGEMENT]: 'admin',
    [SYSTEM_ROLES.PROGRAM_STAFF]: 'officer',
    [SYSTEM_ROLES.OPERATIONS]: 'officer',
    [SYSTEM_ROLES.INTERN]: 'intern',
    [SYSTEM_ROLES.FACILITATOR]: 'volunteer',
};

const runtimePermissionOverrides = {
    ADMIN_FINANCE_ASSISTANT: ['settings.finance_threshold.read'],
    FIELD_OFFICER_1: ['expense.read'],
};

export const FINANCE_LOGISTICS_ROLE_CODES = new Set([
    'DIRECTOR',
    'FINANCE_OFFICER',
    'ADMIN_FINANCE_ASSISTANT',
    'SYSTEM_ADMIN',
]);

export const canSeeOrganizationFinance = (actor) =>
    actor?.system_role === SYSTEM_ROLES.SUPER_ADMIN ||
    FINANCE_LOGISTICS_ROLE_CODES.has(actor?.role_code);

export const canSeeOrganizationDashboard = (actor) =>
    actor?.system_role === SYSTEM_ROLES.SUPER_ADMIN ||
    actor?.role_code === 'DIRECTOR' ||
    actor?.role_code === 'FINANCE_OFFICER' ||
    actor?.role_code === 'ADMIN_FINANCE_ASSISTANT';

export const canSeeOrganizationIndicators = (actor) =>
    actor?.system_role === SYSTEM_ROLES.SUPER_ADMIN ||
    actor?.role_code === 'DIRECTOR';

const programOfficerPermissions = [
    'program.read',
    'project.read',
    'project.create',
    'project.update',
    'indicator.read_assigned',
    'indicator.create',
    'indicator.update',
    'progress.create',
    'activity.read',
    'activity.create',
    'expense.create',
    'kobo.manage',
    'kobo.sync',
    'volunteer.submit',
    'volunteer.read_own',
];

const rolePermissionFallbacks = {
    FINANCE_OFFICER: [
        'user.view',
        'indicator.read_all',
        'activity.read',
        'expense.read',
        'expense.review_finance',
        'settings.finance_threshold.read',
        'approval.read',
        'volunteer.submit',
        'volunteer.read_own',
    ],
    ADMIN_FINANCE_ASSISTANT: [
        'user.view',
        'user.create',
        'user.update',
        'user.assign_role',
        'indicator.read_all',
        'activity.read',
        'approval.read',
        'governance.pending_roles.read',
        'volunteer.submit',
        'volunteer.read_own',
        'indicator.read_assigned',
        'activity.create',
        'project.read',
    ],
    SRHR_OFFICER: programOfficerPermissions,
    PROGRAMS_ME_OFFICER: programOfficerPermissions,
    MEL_OFFICER: [
        'program.read',
        'project.read',
        'indicator.read_all',
        'indicator.update',
        'activity.read',
        'approval.read',
        'kobo.manage',
        'kobo.sync',
        'volunteer.submit',
        'volunteer.read_own',
    ],
    FIELD_OFFICER_1: [
        ...programOfficerPermissions,
        'announcement.approve',
    ],
    FIELD_OFFICER_2: [
        ...programOfficerPermissions,
        'announcement.approve',
    ],
    YOUTH_KNOWLEDGE_HUB_OFFICER: [
        ...programOfficerPermissions,
        'announcement.approve',
    ],
    YOUTH_FACILITATOR_PEER_EDUCATOR: [
        'project.read',
        'activity.read',
        'volunteer.submit',
        'volunteer.read_own',
        'announcement.create',
    ],
};

// Add announcement.create and announcement.approve to other roles
[
    'DIRECTOR',
    'FINANCE_OFFICER',
    'ADMIN_FINANCE_ASSISTANT',
    'SRHR_OFFICER',
    'PROGRAMS_ME_OFFICER',
    'MEL_OFFICER'
].forEach(role => {
    if (rolePermissionFallbacks[role]) {
        rolePermissionFallbacks[role].push('announcement.create');
        if (role !== 'ADMIN_FINANCE_ASSISTANT') {
            rolePermissionFallbacks[role].push('announcement.approve');
        }
    }
});
export const toLegacyRole = (roleCode, systemRole) => {
    if (systemRole && systemRoleToLegacy[systemRole]) return systemRoleToLegacy[systemRole];
    return legacyRoleMap[roleCode] || 'intern';
};

export const resolveSystemRole = (roleCode, fallbackSystemRole = null) =>
    fallbackSystemRole || ROLE_TO_SYSTEM_ROLE[roleCode] || SYSTEM_ROLES.INTERN;

export const normalizeRoleCodeInput = (inputRole) => {
    if (!inputRole) return null;
    const candidate = String(inputRole).trim();
    const upper = candidate.toUpperCase();
    
    // Check if it's already a canonical job role
    if (ROLE_CODES.includes(upper)) return upper;
    
    // Check if it's a legacy label
    const lower = candidate.toLowerCase();
    if (legacyToCanonicalMap[lower]) return legacyToCanonicalMap[lower];
    
    return null;
};

const asInt = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const extractExplicitUserId = (event, body = null) => {
    const query = event?.queryStringParameters || {};
    const payload = body || {};

    return (
        asInt(payload.userId) ||
        asInt(payload.user_id) ||
        asInt(payload.adminId) ||
        asInt(payload.admin_id) ||
        asInt(payload.actorUserId) ||
        asInt(payload.approverUserId) ||
        asInt(query.userId) ||
        asInt(query.user_id) ||
        asInt(query.adminId) ||
        asInt(query.actorUserId)
    );
};

export const getAuthenticatedUserId = (event) => {
    const token = getBearerTokenFromHeaders(event?.headers || {});
    const session = verifySessionToken(token);
    return asInt(session?.userId);
};

export const getRequestUserId = (event, body = null) => {
    const authenticatedUserId = getAuthenticatedUserId(event);
    const explicitUserId = extractExplicitUserId(event, body);

    if (!authenticatedUserId) {
        throw new HttpError('Authentication required', 401);
    }

    if (explicitUserId && explicitUserId !== authenticatedUserId) {
        throw new HttpError('Authenticated user does not match request actor', 403);
    }

    return authenticatedUserId;
};

export const getUserContext = async (userId) => {
    const normalizedUserId = asInt(userId);
    if (!normalizedUserId) throw new HttpError('Valid userId is required', 400);

    const users = await sql`
        SELECT
            u.id, u.name, u.email,
            u.role_code, u.system_role, u.job_title, u.short_bio, u.profile_picture_url,
            u.role_assignment_status, u.role_confirmed_at,
            u.require_password_reset
        FROM users u
        WHERE u.id = ${normalizedUserId}
        LIMIT 1
    `;

    if (users.length === 0) {
        throw new HttpError('User not found', 404);
    }

    const user = users[0];
    const systemRole = resolveSystemRole(user.role_code, user.system_role);
    const identity = buildIdentity(user, { systemRole });
    const jobTitle = identity.displayTitle;

    // Permissions can still be fetched by role_code for now, or we can map them by system_role
    // User requested: "Access is enforced by system_role"
    // So let's fetch permissions mapped to the system_role if we have a table, 
    // or logically enforce them. 
    // To keep it clean, we'll continue using the role_permissions table but we might
    // need to ensure it has entries for the system roles.
    
    let permissionRows = [];
    try {
        permissionRows = await sql`
            SELECT rp.permission_code
            FROM role_permissions rp
            WHERE rp.role_code = ${user.role_code}
        `;
    } catch (rpErr) {
        console.warn('Could not load permissions from role_permissions table:', rpErr.message);
    }

    const permissions = new Set(permissionRows.map((row) => row.permission_code));
    for (const permission of rolePermissionFallbacks[user.role_code] || []) {
        permissions.add(permission);
    }

    // System admins should always resolve to full platform permissions even when
    // production RBAC seed data is partial or stale.
    if (user.role_code === 'SYSTEM_ADMIN') {
        try {
            const allPermissionRows = await sql`SELECT code FROM permissions`;
            for (const row of allPermissionRows) {
                permissions.add(row.code);
            }
        } catch (permErr) {
            console.warn('Could not load all permissions for SYSTEM_ADMIN (permissions table may not exist yet):', permErr.message);
        }
    }

    // Production can lag behind RBAC seed data, especially for executive roles.
    if (
        permissions.size === 0 &&
        user.role_code === 'DIRECTOR'
    ) {
        try {
            const allPermissionRows = await sql`SELECT code FROM permissions`;
            for (const row of allPermissionRows) {
                permissions.add(row.code);
            }
        } catch (permErr) {
            console.warn('Could not load all permissions for DIRECTOR (permissions table may not exist yet):', permErr.message);
        }
    }

    for (const permission of runtimePermissionOverrides[user.role_code] || []) {
        permissions.add(permission);
    }

    // Role boundary enforcement
    // System settings and administrative user management should ONLY be accessible to SYSTEM_ADMIN (SUPER_ADMIN)
    if (systemRole !== SYSTEM_ROLES.SUPER_ADMIN) {
        // Remove administrative permissions for non-super admins like DIRECTOR
        for (const perm of [...permissions]) {
            if (perm.startsWith('settings.') || 
                (perm.startsWith('user.') && !perm.includes('.view') && !perm.includes('.read'))) {
                permissions.delete(perm);
            }
            // Also restrict finance threshold updates to SYSTEM_ADMIN or DIRECTOR (Director is handled by specific checks in UI/API, but let's be explicit here)
            if (perm === 'settings.finance_threshold.update' && user.role_code !== 'DIRECTOR' && systemRole !== SYSTEM_ROLES.SUPER_ADMIN) {
                permissions.delete(perm);
            }
        }
    }

    const roleAssignmentStatus = user.role_assignment_status || 'pending_reassignment';

    return {
        ...user,
        system_role: systemRole,
        job_title: jobTitle,
        department: identity.department,
        employment_type: identity.employmentType,
        identity,
        role_code: user.role_code,
        role_assignment_status: roleAssignmentStatus,
        role: toLegacyRole(user.role_code, systemRole),
        is_pending_reassignment: roleAssignmentStatus !== 'confirmed' && systemRole !== SYSTEM_ROLES.SUPER_ADMIN,
        permissions,
    };
};

export const hasPermission = (userContext, permissionCode) => {
    if (!userContext || !permissionCode) return false;
    if (userContext.system_role === SYSTEM_ROLES.SUPER_ADMIN) return true;
    return userContext.permissions.has(permissionCode);
};

export const ensurePermission = (
    userContext,
    permissionCode,
    options = { allowPending: false }
) => {
    const allowPending = options?.allowPending === true;

    if (!allowPending && userContext.is_pending_reassignment) {
        throw new HttpError(
            'Role reassignment pending confirmation. Action is not allowed yet.',
            403
        );
    }

    if (!hasPermission(userContext, permissionCode)) {
        throw new HttpError('Permission denied', 403);
    }
};

export const ensureAnyPermission = (
    userContext,
    permissionCodes,
    options = { allowPending: false }
) => {
    const allowPending = options?.allowPending === true;

    if (!allowPending && userContext.is_pending_reassignment) {
        throw new HttpError(
            'Role reassignment pending confirmation. Action is not allowed yet.',
            403
        );
    }

    const allowed = permissionCodes.some((code) => hasPermission(userContext, code));
    if (!allowed) {
        throw new HttpError('Permission denied', 403);
    }
};

export const assertConfirmedRoleForMutation = (userContext) => {
    if (userContext.is_pending_reassignment) {
        throw new HttpError(
            'Role reassignment is pending. Director confirmation required before mutation actions.',
            403
        );
    }
};

export const setAuditActor = async (dbClient, userId) => {
    const actorId = asInt(userId);
    if (!actorId) return;
    await dbClient`SELECT set_config('app.user_id', ${String(actorId)}, true)`;
};

export const loadProjectAssignment = async (projectId, userId) => {
    const project = projectId || null;
    const actor = asInt(userId);
    if (!project || !actor) return false;

    const assignment = await sql`
        SELECT id
        FROM project_assignments
        WHERE project_id = ${project}
          AND user_id = ${actor}
          AND is_active = TRUE
        LIMIT 1
    `;

    return assignment.length > 0;
};
