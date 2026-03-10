import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);
        ensureAnyPermission(actor, ['governance.pending_roles.read', 'role.confirm']);

        const pending = await sql`
            SELECT
                id,
                name,
                email,
                role_code,
                role_assignment_status,
                role_legacy_snapshot,
                created_at
            FROM users
            WHERE role_assignment_status = 'pending_reassignment'
            ORDER BY created_at ASC
        `;

        return successResponse(pending);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Pending role assignments error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
