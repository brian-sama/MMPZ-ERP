// Consolidated Notifications endpoint - Netlify Function
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, getPathParam, getQueryParams, parseBody } from './utils/response.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const id = getPathParam(event, 'id') || getPathParam(event, 'notifications');

        // GET - List Notifications
        if (method === 'GET') {
            const { userId } = getQueryParams(event);
            if (!userId) return errorResponse('userId is required', 400);

            try {
                const data = await sql`
                    SELECT * FROM notifications 
                    WHERE user_id = ${userId} 
                    ORDER BY created_at DESC 
                    LIMIT 20
                `;
                return successResponse(data);
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // POST/PATCH - Mark as Read
        if (method === 'POST' || method === 'PATCH') {
            const path = event.path;

            if (path.endsWith('/read') && id) {
                // Mark Single Read
                try {
                    await sql`UPDATE notifications SET is_read = true WHERE id = ${id}`;
                    return successResponse({ message: 'Notification marked as read' });
                } catch (dbError) {
                    return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
                }
            }

            if (path.endsWith('/mark-all-read') || path.endsWith('/read-all')) {
                const body = parseBody(event);
                const userId = body.userId || getQueryParams(event).userId;

                if (!userId) return errorResponse('userId is required', 400);

                try {
                    await sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId}`;
                    return successResponse({ message: 'All notifications marked as read' });
                } catch (dbError) {
                    return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
                }
            }
        }

        return errorResponse('Method not allowed', 405);

    } catch (error) {
        console.error('Notifications function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
