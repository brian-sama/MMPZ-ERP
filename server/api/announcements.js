import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getPathParam } from './utils/response.js';
import { getUserContext, getRequestUserId, ensurePermission, SYSTEM_ROLES } from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const path = event.path;
        const body = parseBody(event);
        const userId = getRequestUserId(event, body);
        const user = await getUserContext(userId);

        // GET /announcements - Fetch based on audience
        if (method === 'GET') {
            const announcements = await sql`
                SELECT a.*, u.name as author_name
                FROM announcements a
                LEFT JOIN users u ON a.author_id = u.id
                WHERE a.is_active = TRUE
                  AND (
                    'ALL' = ANY(a.audience) 
                    OR ${user.system_role} = ANY(a.audience)
                    OR a.author_id = ${user.id}
                  )
                ORDER BY a.created_at DESC
            `;
            return successResponse(announcements);
        }

        // POST /announcements - Create (Restricted: Not Facilitators)
        if (method === 'POST') {
            if (user.system_role === SYSTEM_ROLES.FACILITATOR) {
                return errorResponse('Facilitators cannot post announcements', 403);
            }

            const { title, content, audience } = body;
            if (!title || !content) {
                return errorResponse('Title and content are required', 400);
            }

            const targetedAudience = Array.isArray(audience) ? audience : ['ALL'];

            const created = await sql`
                INSERT INTO announcements (title, content, author_id, audience)
                VALUES (${title}, ${content}, ${user.id}, ${targetedAudience})
                RETURNING *
            `;
            return successResponse(created[0]);
        }

        // DELETE /announcements/:id
        if (method === 'DELETE') {
            const id = getPathParam(event, 'id');
            if (!id) return errorResponse('ID required', 400);

            // Only author or admin can delete
            const existing = await sql`SELECT author_id FROM announcements WHERE id = ${id}`;
            if (existing.length === 0) return errorResponse('Not found', 404);

            if (existing[0].author_id !== user.id && user.system_role !== SYSTEM_ROLES.SUPER_ADMIN) {
                return errorResponse('Unauthorized', 403);
            }

            await sql`UPDATE announcements SET is_active = FALSE WHERE id = ${id}`;
            return successResponse({ message: 'Announcement removed' });
        }

        return errorResponse('Not found', 404);
    } catch (err) {
        console.error('Announcements error:', err);
        return errorResponse('Internal server error', 500);
    }
};
