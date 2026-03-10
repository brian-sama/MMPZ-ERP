import { sql } from './db.js';

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

export const toLegacyRole = (roleCode) => {
    return legacyRoleMap[roleCode] || 'intern';
};

export const normalizeRoleCodeInput = (inputRole) => {
    if (!inputRole) return null;
    const candidate = String(inputRole).trim();
    const upper = candidate.toUpperCase();
    if (ROLE_CODES.includes(upper)) return upper;

    const lower = candidate.toLowerCase();
    if (legacyToCanonicalMap[lower]) return legacyToCanonicalMap[lower];
    return null;
};

const asInt = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
};

export const getRequestUserId = (event, body = null) => {
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

export const getUserContext = async (userId) => {
    const normalizedUserId = asInt(userId);
    if (!normalizedUserId) throw new HttpError('Valid userId is required', 400);

    const users = await sql`
        SELECT
            u.id,
            u.name,
            u.email,
            u.role_code,
            u.role_assignment_status,
            u.role_confirmed_at,
            u.require_password_reset
        FROM users u
        WHERE u.id = ${normalizedUserId}
        LIMIT 1
    `;

    if (users.length === 0) {
        throw new HttpError('User not found', 404);
    }

    const user = users[0];
    const roleCode = user.role_code || 'DEVELOPMENT_FACILITATOR';

    const permissionRows = await sql`
        SELECT rp.permission_code
        FROM role_permissions rp
        WHERE rp.role_code = ${roleCode}
    `;

    const permissions = new Set(permissionRows.map((row) => row.permission_code));
    const roleAssignmentStatus = user.role_assignment_status || 'pending_reassignment';

    return {
        ...user,
        role_code: roleCode,
        role_assignment_status: roleAssignmentStatus,
        role: toLegacyRole(roleCode),
        is_pending_reassignment: roleAssignmentStatus !== 'confirmed',
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
