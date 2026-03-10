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
        ensureAnyPermission(actor, ['user.view', 'role.confirm', 'governance.pending_roles.read'], {
            allowPending: true,
        });

        const roles = await sql`
            SELECT
                r.code,
                r.name,
                r.description,
                r.is_executive,
                COALESCE(
                    json_agg(rp.permission_code ORDER BY rp.permission_code)
                    FILTER (WHERE rp.permission_code IS NOT NULL),
                    '[]'::json
                ) AS permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON rp.role_code = r.code
            GROUP BY r.code, r.name, r.description, r.is_executive
            ORDER BY r.name ASC
        `;

        return successResponse(roles);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Roles function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
