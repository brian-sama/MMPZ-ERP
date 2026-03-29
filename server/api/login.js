// Login endpoint.
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody } from './utils/response.js';
import { comparePassword } from './utils/auth.js';
import { resolveSystemRole, toLegacyRole } from './utils/rbac.js';
import { issueSessionToken } from './utils/session-token.js';

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
        const { email, password } = parseBody(event);

        // Validate input
        if (!email || !password) {
            return errorResponse('Email and password are required', 400);
        }

        // Query user from PostgreSQL
        let users;
        try {
            users = await sql`
                SELECT
                    id,
                    name,
                    email,
                    role_code,
                    system_role,
                    job_title,
                    short_bio,
                    profile_picture_url,
                    role_assignment_status,
                    role_confirmed_at,
                    password_hash,
                    require_password_reset,
                    failed_login_attempts,
                    locked_at
                FROM users
                WHERE email = ${email}
                LIMIT 1
            `;
        } catch (dbError) {
            console.error('Database error:', dbError);
            return errorResponse('Database error', 500, dbError.message);
        }

        if (!users || users.length === 0) {
            return errorResponse('Invalid email or password', 401);
        }

        const user = users[0];

        // Check if account is locked
        if (user.locked_at) {
            return errorResponse('Account is locked due to multiple failed login attempts. Please contact a System Administrator to reset your password.', 403);
        }

        // Verify password
        const isValid = await comparePassword(password, user.password_hash);

        if (!isValid) {
            const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
            
            if (newFailedAttempts >= 3) {
                await sql`
                    UPDATE users 
                    SET failed_login_attempts = ${newFailedAttempts},
                        locked_at = CURRENT_TIMESTAMP 
                    WHERE id = ${user.id}
                `;
                return errorResponse('Account has been locked after 3 failed attempts. Please contact an administrator.', 403);
            } else {
                await sql`
                    UPDATE users 
                    SET failed_login_attempts = ${newFailedAttempts} 
                    WHERE id = ${user.id}
                `;
                return errorResponse(`Invalid email or password. Attempt ${newFailedAttempts} of 3.`, 401);
            }
        }

        // Success: Reset failed attempts and update last_login
        const systemRole = resolveSystemRole(user.role_code, user.system_role);
        try {
            await sql`
                UPDATE users 
                SET last_login = CURRENT_TIMESTAMP,
                    failed_login_attempts = 0,
                    locked_at = NULL
                WHERE id = ${user.id}
            `;
        } catch (updateError) {
            console.error('Error updating user login stats:', updateError);
        }

        return successResponse({
            token: issueSessionToken(user.id),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role_code: user.role_code,
                system_role: systemRole,
                job_title: user.job_title || user.role_code || 'Intern',
                short_bio: user.short_bio || '',
                profile_picture_url: user.profile_picture_url || null,
                role_assignment_status: user.role_assignment_status || 'pending_reassignment',
                role_confirmed_at: user.role_confirmed_at,
                role: toLegacyRole(user.role_code, systemRole),
                require_password_reset: user.require_password_reset,
            },
        });

    } catch (error) {
        console.error('Login error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
