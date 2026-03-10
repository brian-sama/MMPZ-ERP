import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    ensureAnyPermission,
    setAuditActor,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            ensureAnyPermission(actor, ['program.read', 'indicator.read_all', 'indicator.read_assigned'], {
                allowPending: true,
            });
            const rows = await sql`
                SELECT p.*
                FROM programs p
                ORDER BY p.created_at DESC
            `;
            return successResponse(rows);
        }

        if (method === 'POST') {
            ensurePermission(actor, 'program.create');
            const { name, description, status } = body;
            if (!name) return errorResponse('Program name is required', 400);

            const inserted = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                const rows = await tx`
                    INSERT INTO programs (
                        name,
                        description,
                        status,
                        created_by_user_id,
                        updated_at
                    )
                    VALUES (
                        ${name},
                        ${description || null},
                        ${status || 'active'},
                        ${actor.id},
                        ${new Date().toISOString()}
                    )
                    RETURNING *
                `;
                return rows[0];
            });
            return successResponse({ message: 'Program created successfully', program: inserted });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Programs function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
