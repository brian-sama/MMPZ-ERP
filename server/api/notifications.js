import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, getPathParam, getQueryParams, parseBody } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    setAuditActor,
} from './utils/rbac.js';

const isMissingNotificationStorageError = (error) =>
    error?.code === '42P01' ||
    error?.code === '42703' ||
    /notifications/i.test(error?.message || '') && /does not exist|column/i.test(error?.message || '');

const hasNotificationsTable = async () => {
    const rows = await sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'notifications'
        ) AS exists
    `;
    return Boolean(rows[0]?.exists);
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const id = getPathParam(event, 'id') || getPathParam(event, 'notifications');
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        // GET - list notifications for actor
        if (method === 'GET') {
            if (!(await hasNotificationsTable())) {
                return successResponse([]);
            }

            const data = await sql`
                SELECT *
                FROM notifications
                WHERE user_id = ${actor.id}
                ORDER BY created_at DESC
                LIMIT 20
            `;
            return successResponse(data);
        }

        // PATCH/POST - mark notifications as read
        if (method === 'POST' || method === 'PATCH') {
            if (!(await hasNotificationsTable())) {
                return successResponse({ message: 'Notification storage is not available yet' });
            }

            const path = event.path;

            if (path.endsWith('/read') && id) {
                const existing = await sql`
                    SELECT user_id
                    FROM notifications
                    WHERE id = ${id}
                    LIMIT 1
                `;
                if (existing.length === 0) return errorResponse('Notification not found', 404);
                if (existing[0].user_id !== actor.id) return errorResponse('Permission denied', 403);

                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`UPDATE notifications SET is_read = TRUE WHERE id = ${id}`;
                });

                return successResponse({ message: 'Notification marked as read' });
            }

            if (path.endsWith('/mark-all-read') || path.endsWith('/read-all')) {
                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`UPDATE notifications SET is_read = TRUE WHERE user_id = ${actor.id}`;
                });
                return successResponse({ message: 'All notifications marked as read' });
            }
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        if (isMissingNotificationStorageError(error)) {
            if (event.httpMethod === 'GET') return successResponse([]);
            return successResponse({ message: 'Notification storage is not available yet' });
        }
        console.error('Notifications function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
