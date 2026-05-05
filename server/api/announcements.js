import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getPathParam } from './utils/response.js';
import {
    HttpError,
    getUserContext,
    getRequestUserId,
    SYSTEM_ROLES,
} from './utils/rbac.js';
import { createNotifications } from './utils/notification-center.js';

const ALLOWED_AUDIENCES = new Set([
    'ALL',
    SYSTEM_ROLES.SUPER_ADMIN,
    SYSTEM_ROLES.MANAGEMENT,
    SYSTEM_ROLES.PROGRAM_STAFF,
    SYSTEM_ROLES.OPERATIONS,
    SYSTEM_ROLES.INTERN,
    SYSTEM_ROLES.FACILITATOR,
]);

const normalizeAudience = (audience) => {
    const values = Array.isArray(audience) ? audience : [audience || 'ALL'];
    const cleaned = values
        .map((value) => String(value || '').trim().toUpperCase())
        .filter((value) => ALLOWED_AUDIENCES.has(value));

    return cleaned.length > 0 ? [...new Set(cleaned)] : ['ALL'];
};

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
                    (a.approval_status = 'approved' OR a.approval_status IS NULL) -- Backwards compatibility
                    OR a.author_id = ${user.id}
                    OR ${user.role_code} IN ('DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'PSYCHOSOCIAL_SUPPORT_OFFICER', 'COMMUNITY_DEVELOPMENT_OFFICER', 'ME_INTERN_ACTING_OFFICER', 'SOCIAL_SERVICES_INTERN', 'YOUTH_COMMUNICATIONS_INTERN')
                  )
                  AND (
                    'ALL' = ANY(a.audience) 
                    OR ${user.system_role} = ANY(a.audience)
                    OR a.author_id = ${user.id}
                  )
                ORDER BY a.created_at DESC
            `;
            return successResponse(announcements);
        }

        // POST /announcements - Create
        if (method === 'POST') {
            const { title, content, audience } = body;
            if (!title || !content) {
                return errorResponse('Title and content are required', 400);
            }

            const targetedAudience = normalizeAudience(audience);
            const isFacilitator = user.system_role === SYSTEM_ROLES.FACILITATOR;
            const initialStatus = isFacilitator ? 'pending' : 'approved';
            const isPublic = !isFacilitator;

            const created = await sql.begin(async (tx) => {
                const rows = await tx`
                    INSERT INTO announcements (title, content, author_id, audience, approval_status, is_public)
                    VALUES (${title}, ${content}, ${user.id}, ${targetedAudience}, ${initialStatus}, ${isPublic})
                    RETURNING *
                `;

                if (!isFacilitator) {
                    const recipients = targetedAudience.includes('ALL')
                        ? await tx`SELECT id FROM users WHERE id <> ${user.id}`
                        : (await tx`
                            SELECT id, system_role
                            FROM users
                            WHERE id <> ${user.id}
                        `).filter((recipient) => targetedAudience.includes(String(recipient.system_role || '').toUpperCase()));

                    await createNotifications(
                        tx,
                        recipients.map((recipient) => ({
                            userId: recipient.id,
                            type: 'system',
                            title: 'New internal announcement',
                            message: title,
                            relatedEntityType: 'announcement',
                            relatedEntityId: String(rows[0].id),
                            actionUrl: '/intranet/dashboard',
                        }))
                    );
                } else {
                    // Notify reviewers (Officers/Interns/Director)
                    const reviewers = await tx`
                        SELECT id FROM users 
                        WHERE role_code IN ('DIRECTOR', 'PSYCHOSOCIAL_SUPPORT_OFFICER', 'COMMUNITY_DEVELOPMENT_OFFICER', 'SOCIAL_SERVICES_INTERN', 'YOUTH_COMMUNICATIONS_INTERN')
                    `;
                    await createNotifications(
                        tx,
                        reviewers.map((rev) => ({
                            userId: rev.id,
                            type: 'governance',
                            title: 'Announcement approval requested',
                            message: `Facilitator ${user.name} posted: ${title}`,
                            relatedEntityType: 'announcement',
                            relatedEntityId: String(rows[0].id),
                            actionUrl: '/intranet/dashboard',
                        }))
                    );
                }

                return rows;
            });
            return successResponse(created[0]);
        }

        // POST /announcements/:id/approve - Approve (Officers/Interns/Director)
        const approveMatch = path.match(/\/api\/announcements\/([^\/]+)\/approve$/);
        if (method === 'POST' && approveMatch) {
            const id = approveMatch[1];
            if (user.role_code === 'DEVELOPMENT_FACILITATOR') {
                return errorResponse('Facilitators cannot approve announcements', 403);
            }

            const [updated] = await sql`
                UPDATE announcements
                SET approval_status = 'approved', 
                    is_public = TRUE,
                    approved_by_user_id = ${user.id},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING *
            `;

            if (!updated) return errorResponse('Announcement not found', 404);

            return successResponse(updated);
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
        if (err instanceof HttpError) {
            return errorResponse(err.message, err.statusCode);
        }
        console.error('Announcements error:', err);
        return errorResponse('Internal server error', 500, err.message);
    }
};
