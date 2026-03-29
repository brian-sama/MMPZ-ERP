import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody } from './utils/response.js';
import { hashPassword, comparePassword, validatePassword } from './utils/auth.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        if (event.httpMethod !== 'POST') return errorResponse('Method not allowed', 405);

        const body = parseBody(event);
        const userId = getRequestUserId(event, body);
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return errorResponse('Current password and new password are required', 400);
        }

        // Validate password strength
        const validation = validatePassword(newPassword);
        if (!validation.isValid) {
            return errorResponse(validation.message, 400);
        }

        // Fetch user with hash
        const users = await sql`
            SELECT id, password_hash
            FROM users
            WHERE id = ${userId}
            LIMIT 1
        `;

        if (users.length === 0) return errorResponse('User not found', 404);
        const user = users[0];

        // Verify current password
        const isMatch = await comparePassword(currentPassword, user.password_hash);
        if (!isMatch) {
            return errorResponse('Current password is incorrect', 401);
        }

        // Hash and update
        const newHash = await hashPassword(newPassword);
        await sql`
            UPDATE users
            SET 
                password_hash = ${newHash},
                require_password_reset = FALSE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${userId}
        `;

        return successResponse({ message: 'Password changed successfully' });
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Change password error:', error);
        return errorResponse('Internal server error', 500);
    }
};
