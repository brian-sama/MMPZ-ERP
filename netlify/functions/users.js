// Consolidated Users endpoint - Netlify Function
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getPathParam } from './utils/response.js';
import { hashPassword } from './utils/auth.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const id = getPathParam(event, 'id') || getPathParam(event, 'users');

        // GET - List Users
        if (method === 'GET') {
            try {
                const data = await sql`SELECT id, name, email, role, require_password_reset, last_login, created_at FROM users ORDER BY created_at DESC`;
                return successResponse(data);
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // POST - Create User
        if (method === 'POST') {
            const body = parseBody(event);
            const { name, email, password, role } = body;
            if (!name || !email || !password || !role) {
                return errorResponse('Missing required fields', 400);
            }

            try {
                const password_hash = await hashPassword(password);
                const require_reset = body.require_password_reset === true || body.requirePasswordReset === true;
                const inserted = await sql`
                    INSERT INTO users (name, email, password_hash, role, require_password_reset) 
                    VALUES (${name}, ${email}, ${password_hash}, ${role}, ${require_reset}) 
                    RETURNING id, name, email, role, require_password_reset, created_at
                `;
                return successResponse({ message: 'User created successfully', user: inserted[0] });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // PATCH - Update Role (e.g. /api/users/1/role)
        if (method === 'PATCH') {
            if (!id) return errorResponse('User ID is required', 400);
            const { role } = parseBody(event);
            if (!role) return errorResponse('Role is required', 400);

            try {
                await sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
                return successResponse({ message: 'Role updated successfully' });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // PUT - Update User Details
        if (method === 'PUT') {
            if (!id) return errorResponse('User ID is required', 400);

            const body = parseBody(event);
            const { name, email, password, role } = body;
            const require_reset = body.require_password_reset === true || body.requirePasswordReset === true;

            if (!name || !email || !role) {
                return errorResponse('Name, email and role are required', 400);
            }

            try {
                // If password provided, hash it. Otherwise use existing
                let updated;
                if (password && password.trim() !== '') {
                    const password_hash = await hashPassword(password);
                    updated = await sql`
                        UPDATE users 
                        SET name = ${name}, email = ${email}, role = ${role}, password_hash = ${password_hash}, require_password_reset = ${require_reset}
                        WHERE id = ${id}
                        RETURNING id, name, email, role, require_password_reset, created_at
                    `;
                } else {
                    updated = await sql`
                        UPDATE users 
                        SET name = ${name}, email = ${email}, role = ${role}, require_password_reset = ${require_reset}
                        WHERE id = ${id}
                        RETURNING id, name, email, role, require_password_reset, created_at
                    `;
                }

                if (updated.length === 0) return errorResponse('User not found', 404);
                return successResponse({ message: 'User updated successfully', user: updated[0] });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // DELETE - Delete User
        if (method === 'DELETE') {
            if (!id) return errorResponse('User ID is required', 400);
            try {
                await sql`DELETE FROM users WHERE id = ${id}`;
                return successResponse({ message: 'User deleted successfully' });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        return errorResponse('Method not allowed', 405);

    } catch (error) {
        console.error('Users function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
