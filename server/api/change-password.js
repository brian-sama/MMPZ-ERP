import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody } from './utils/response.js';
import { comparePassword, hashPassword, validatePassword } from './utils/auth.js';
import { getRequestUserId, HttpError } from './utils/rbac.js';

export const handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return corsResponse();
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const body = parseBody(event);
        const userId = getRequestUserId(event, body);

        const { currentPassword, newPassword } = body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return errorResponse('Current password and new password are required', 400);
        }

        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            return errorResponse(passwordValidation.message, 400);
        }

        // 1. Get user hash from DB
        let users;
        try {
            users = await sql`
                SELECT id, password_hash
                FROM users
                WHERE id = ${userId}
                LIMIT 1
            `;
        } catch (dbError) {
            console.error('Database error fetching user for password change:', dbError);
            return errorResponse('Database error', 500);
        }

        if (!users || users.length === 0) {
            return errorResponse('User not found', 404);
        }

        const user = users[0];

        // 2. Verify current password
        const isMatch = await comparePassword(currentPassword, user.password_hash);
        if (!isMatch) {
            return errorResponse('Current password is incorrect', 401);
        }

        // 3. Hash new password
        const hashedNewPassword = await hashPassword(newPassword);

        // 4. Update password and reset lockout/reset flags
        try {
            await sql`
                UPDATE users
                SET password_hash = ${hashedNewPassword},
                    require_password_reset = FALSE,
                    failed_login_attempts = 0,
                    locked_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${userId}
            `;
        } catch (updateError) {
            console.error('Database error updating password:', updateError);
            return errorResponse('Failed to update password in database', 500);
        }

        return successResponse({ message: 'Password changed successfully' });

    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }

        console.error('Password change error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
