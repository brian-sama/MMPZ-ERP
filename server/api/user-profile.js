import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const userId = getRequestUserId(event, body);
        const actor = await getUserContext(userId);

        if (method === 'PATCH') {
            const { profile_picture_url, name } = body;

            const updates = {};
            if (profile_picture_url !== undefined) updates.profile_picture_url = profile_picture_url;
            if (name !== undefined) updates.name = name;

            if (Object.keys(updates).length === 0) {
                return errorResponse('No update data provided', 400);
            }

            await sql`
                UPDATE users
                SET ${sql(updates)},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${actor.id}
            `;

            return successResponse({ message: 'Profile updated successfully', updates });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('User profile function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
