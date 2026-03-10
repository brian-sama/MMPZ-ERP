import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            const { facilitator_id, project_id } = query;
            let rows;
            if (facilitator_id) {
                rows = await sql`
                    SELECT fa.*, p.name as project_name
                    FROM facilitator_assignments fa
                    JOIN projects p ON fa.project_id = p.id
                    WHERE fa.facilitator_user_id = ${facilitator_id}
                    ORDER BY fa.assigned_at DESC
                `;
            } else if (project_id) {
                rows = await sql`
                    SELECT fa.*, u.name as facilitator_name
                    FROM facilitator_assignments fa
                    JOIN users u ON fa.facilitator_user_id = u.id
                    WHERE fa.project_id = ${project_id}
                    ORDER BY fa.assigned_at DESC
                `;
            } else {
                rows = await sql`SELECT * FROM facilitator_assignments ORDER BY assigned_at DESC LIMIT 100`;
            }
            return successResponse(rows);
        }

        if (method === 'POST') {
            ensurePermission(actor, 'user.assign_role');
            const { facilitator_user_id, project_id } = body;
            if (!facilitator_user_id || !project_id) return errorResponse('Facilitator ID and Project ID are required', 400);

            const inserted = await sql`
                INSERT INTO facilitator_assignments (facilitator_user_id, project_id)
                VALUES (${facilitator_user_id}, ${project_id})
                ON CONFLICT (facilitator_user_id, project_id) DO UPDATE SET is_active = TRUE
                RETURNING *
            `;
            return successResponse({ message: 'Facilitator assigned successfully', assignment: inserted[0] });
        }

        if (method === 'PATCH') {
            ensurePermission(actor, 'user.assign_role');
            const { id, is_active } = body;
            if (!id) return errorResponse('ID is required', 400);

            await sql`UPDATE facilitator_assignments SET is_active = ${is_active} WHERE id = ${id}`;
            return successResponse({ message: 'Assignment updated' });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Facilitator Assignments function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
