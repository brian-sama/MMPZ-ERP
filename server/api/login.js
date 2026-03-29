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
                    role_assignment_status,
                    role_confirmed_at,
                    password_hash,
                    require_password_reset
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

        // Verify password
        const isValid = await comparePassword(password, user.password_hash);

        if (!isValid) {
            return errorResponse('Invalid email or password', 401);
        }

        // Update last_login timestamp
        try {
            await sql`UPDATE users SET last_login = ${new Date().toISOString()} WHERE id = ${user.id}`;
        } catch (updateError) {
            console.error('Error updating last login:', updateError);
            // Non-critical error, continue
        }

        // Return user data (without password)
        const systemRole = resolveSystemRole(user.role_code, user.system_role);
        return successResponse({
            token: issueSessionToken(user.id),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role_code: user.role_code,
                system_role: systemRole,
                job_title: user.job_title || user.role_code || 'Intern',
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
