import { sql } from './db.js';
import {
    getBearerTokenFromHeaders,
    verifySessionToken,
} from './session-token.js';

export class HttpError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}

export const ROLE_CODES = [
    'DIRECTOR',
    'FINANCE_ADMIN_OFFICER',
    'ADMIN_ASSISTANT',
    'LOGISTICS_ASSISTANT',
    'PSYCHOSOCIAL_SUPPORT_OFFICER',
    'COMMUNITY_DEVELOPMENT_OFFICER',
    'ME_INTERN_ACTING_OFFICER',
    'SOCIAL_SERVICES_INTERN',
    'YOUTH_COMMUNICATIONS_INTERN',
    'DEVELOPMENT_FACILITATOR',
];

const legacyRoleMap = {
    DIRECTOR: 'admin',
    FINANCE_ADMIN_OFFICER: 'officer',
    ADMIN_ASSISTANT: 'admin',
    LOGISTICS_ASSISTANT: 'officer',
    PSYCHOSOCIAL_SUPPORT_OFFICER: 'officer',
    COMMUNITY_DEVELOPMENT_OFFICER: 'officer',
    ME_INTERN_ACTING_OFFICER: 'officer',
    SOCIAL_SERVICES_INTERN: 'intern',
    YOUTH_COMMUNICATIONS_INTERN: 'intern',
    DEVELOPMENT_FACILITATOR: 'volunteer',
};

const legacyToCanonicalMap = {
    admin: 'ADMIN_ASSISTANT',
    director: 'DIRECTOR',
    officer: 'COMMUNITY_DEVELOPMENT_OFFICER',
    intern: 'SOCIAL_SERVICES_INTERN',
    volunteer: 'DEVELOPMENT_FACILITATOR',
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
    FINANCE_ADMIN_OFFICER: SYSTEM_ROLES.PROGRAM_STAFF,
    ADMIN_ASSISTANT: SYSTEM_ROLES.OPERATIONS,
    LOGISTICS_ASSISTANT: SYSTEM_ROLES.OPERATIONS,
    PSYCHOSOCIAL_SUPPORT_OFFICER: SYSTEM_ROLES.PROGRAM_STAFF,
    COMMUNITY_DEVELOPMENT_OFFICER: SYSTEM_ROLES.PROGRAM_STAFF,
    ME_INTERN_ACTING_OFFICER: SYSTEM_ROLES.INTERN,
    SOCIAL_SERVICES_INTERN: SYSTEM_ROLES.INTERN,
    YOUTH_COMMUNICATIONS_INTERN: SYSTEM_ROLES.INTERN,
    DEVELOPMENT_FACILITATOR: SYSTEM_ROLES.FACILITATOR,
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
    ADMIN_ASSISTANT: ['settings.finance_threshold.read'],
    LOGISTICS_ASSISTANT: ['expense.read'],
};

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
            u.role_code, u.system_role, u.job_title,
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
    const jobTitle = user.job_title || user.role_code || 'Intern';

    // Permissions can still be fetched by role_code for now, or we can map them by system_role
    // User requested: "Access is enforced by system_role"
    // So let's fetch permissions mapped to the system_role if we have a table, 
    // or logically enforce them. 
    // To keep it clean, we'll continue using the role_permissions table but we might
    // need to ensure it has entries for the system roles.
    
    const permissionRows = await sql`
        SELECT rp.permission_code
        FROM role_permissions rp
        WHERE rp.role_code = ${user.role_code}
    `;

    const permissions = new Set(permissionRows.map((row) => row.permission_code));
    for (const permission of runtimePermissionOverrides[user.role_code] || []) {
        permissions.add(permission);
    }
    const roleAssignmentStatus = user.role_assignment_status || 'pending_reassignment';

    return {
        ...user,
        system_role: systemRole,
        job_title: jobTitle,
        role_code: user.role_code,
        role_assignment_status: roleAssignmentStatus,
        role: toLegacyRole(user.role_code, systemRole),
        is_pending_reassignment: roleAssignmentStatus !== 'confirmed' && systemRole !== SYSTEM_ROLES.SUPER_ADMIN,
        permissions,
    };
};

export const hasPermission = (userContext, permissionCode) => {
    if (!userContext || !permissionCode) return false;
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
