import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
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
            // anyone can read outputs of their assigned projects or if they have read all
            const { activity_id } = query;
            let rows;
            if (activity_id) {
                rows = await sql`SELECT * FROM outputs WHERE activity_id = ${activity_id} ORDER BY created_at ASC`;
            } else {
                rows = await sql`SELECT * FROM outputs ORDER BY created_at DESC LIMIT 100`;
            }
            return successResponse(rows);
        }

        if (method === 'POST') {
            ensurePermission(actor, 'activity.create');
            const { activity_id, title, target_value, unit } = body;
            if (!activity_id || !title) return errorResponse('Activity ID and Title are required', 400);

            const inserted = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                const rows = await tx`
                    INSERT INTO outputs (activity_id, title, target_value, unit)
                    VALUES (${activity_id}, ${title}, ${target_value || 0}, ${unit || null})
                    RETURNING *
                `;
                return rows[0];
            });
            return successResponse({ message: 'Output created successfully', output: inserted });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Outputs function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
