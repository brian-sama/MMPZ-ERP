import { sql } from './utils/db.js';
import {
    successResponse,
    errorResponse,
    corsResponse,
    parseBody,
    getPathParam,
} from './utils/response.js';
import { hashPassword } from './utils/auth.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    hasPermission,
    normalizeRoleCodeInput,
    resolveSystemRole,
    toLegacyRole,
    setAuditActor,
} from './utils/rbac.js';

const sanitizeUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role_code: user.role_code,
    system_role: resolveSystemRole(user.role_code, user.system_role),
    job_title: user.job_title || user.role_code || 'Intern',
    profile_picture_url: user.profile_picture_url || null,
    role_assignment_status: user.role_assignment_status,
    role_confirmed_at: user.role_confirmed_at,
    role: toLegacyRole(user.role_code, resolveSystemRole(user.role_code, user.system_role)),
    require_password_reset: user.require_password_reset,
    last_login: user.last_login,
    created_at: user.created_at,
});

const sanitizeDirectoryUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role_code: user.role_code,
    system_role: resolveSystemRole(user.role_code, user.system_role),
    job_title: user.job_title || user.role_code || 'Team Member',
    profile_picture_url: user.profile_picture_url || null,
    role_assignment_status: user.role_assignment_status,
    created_at: user.created_at,
});

const assertCanAssignRole = (actor, targetRoleCode) => {
    if (targetRoleCode === 'DIRECTOR' && actor.role_code !== 'DIRECTOR') {
        throw new HttpError('Only Director can create or assign Director role', 403);
    }
};

const resolveIncomingRole = (body) => {
    const resolved = normalizeRoleCodeInput(body.role_code || body.role);
    if (!resolved) {
        throw new HttpError('A valid role_code or role is required', 400);
    }
    return resolved;
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const id = getPathParam(event, 'id') || getPathParam(event, 'users');
        const body = parseBody(event);
        const actorUserId = getRequestUserId(event, body);
        const actor = await getUserContext(actorUserId);

        // GET - List users
        if (method === 'GET') {
            const data = await sql`
                SELECT
                    id,
                    name,
                    email,
                    role_code,
                    system_role,
                    job_title,
                    profile_picture_url,
                    role_assignment_status,
                    role_confirmed_at,
                    require_password_reset,
                    last_login,
                    created_at
                FROM users
                ORDER BY created_at DESC
            `;

            if (hasPermission(actor, 'user.view')) {
                return successResponse(data.map(sanitizeUser));
            }

            return successResponse(data.map(sanitizeDirectoryUser));
        }

        // POST - Create user
        if (method === 'POST') {
            ensurePermission(actor, 'user.create');

            const { name, email, password } = body;
            if (!name || !email || !password) {
                return errorResponse('Missing required fields: name, email, password', 400);
            }

            const roleCode = resolveIncomingRole(body);
            const systemRole = body.system_role || body.systemRole || resolveSystemRole(roleCode);
            const jobTitle = body.job_title || body.jobTitle || roleCode;

            assertCanAssignRole(actor, roleCode);

            const passwordHash = await hashPassword(password);
            const requireReset =
                body.require_password_reset === true || body.requirePasswordReset === true;

            const roleStatus = roleCode === 'DIRECTOR' && actor.role_code === 'DIRECTOR'
                ? 'confirmed'
                : 'pending_reassignment';

            const inserted = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                const created = await tx`
                    INSERT INTO users (
                        name,
                        email,
                        password_hash,
                        role_code,
                        system_role,
                        job_title,
                        role_assignment_status,
                        role_confirmed_by_user_id,
                        role_confirmed_at,
                        role_legacy_snapshot,
                        require_password_reset
                    )
                    VALUES (
                        ${name},
                        ${email},
                        ${passwordHash},
                        ${roleCode},
                        ${systemRole},
                        ${jobTitle},
                        ${roleStatus},
                        ${roleStatus === 'confirmed' ? actor.id : null},
                        ${roleStatus === 'confirmed' ? new Date().toISOString() : null},
                        ${body.role || null},
                        ${requireReset}
                    )
                    RETURNING
                        id,
                        name,
                        email,
                        role_code,
                        system_role,
                        job_title,
                        profile_picture_url,
                        role_assignment_status,
                        role_confirmed_at,
                        require_password_reset,
                        last_login,
                        created_at
                `;

                await tx`
                    INSERT INTO user_role_history (
                        user_id,
                        previous_role_code,
                        new_role_code,
                        changed_by_user_id,
                        reason
                    )
                    VALUES (${created[0].id}, ${null}, ${roleCode}, ${actor.id}, ${'Initial role assignment'})
                `;

                return created[0];
            });

            return successResponse({
                message: 'User created successfully',
                user: sanitizeUser(inserted),
            });
        }

        // PATCH - Role operations (/users/:id/role, /users/:id/confirm-role)
        if (method === 'PATCH') {
            if (!id) return errorResponse('User ID is required', 400);
            const path = event.path || '';

            if (path.endsWith('/confirm-role')) {
                ensurePermission(actor, 'role.confirm');
                const existingRows = await sql`
                    SELECT id, role_code
                    FROM users
                    WHERE id = ${id}
                    LIMIT 1
                `;
                if (existingRows.length === 0) return errorResponse('User not found', 404);

                const existing = existingRows[0];
                const requestedRole = body.role_code || body.role;
                const finalRoleCode = requestedRole
                    ? normalizeRoleCodeInput(requestedRole)
                    : existing.role_code;

                if (!finalRoleCode) return errorResponse('Invalid role provided', 400);
                assertCanAssignRole(actor, finalRoleCode);

                const updated = await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);

                    await tx`
                        UPDATE users
                        SET
                            role_code = ${finalRoleCode},
                            role_assignment_status = 'confirmed',
                            role_confirmed_by_user_id = ${actor.id},
                            role_confirmed_at = ${new Date().toISOString()}
                        WHERE id = ${id}
                    `;

                    await tx`
                        INSERT INTO user_role_history (
                            user_id,
                            previous_role_code,
                            new_role_code,
                            changed_by_user_id,
                            reason
                        )
                        VALUES (
                            ${id},
                            ${existing.role_code},
                            ${finalRoleCode},
                            ${actor.id},
                            ${body.reason || 'Director role confirmation'}
                        )
                    `;

                    const rows = await tx`
                        SELECT
                            id,
                            name,
                            email,
                            role_code,
                            system_role,
                            job_title,
                            profile_picture_url,
                            role_assignment_status,
                            role_confirmed_at,
                            require_password_reset,
                            last_login,
                            created_at
                        FROM users
                        WHERE id = ${id}
                        LIMIT 1
                    `;
                    return rows[0];
                });

                return successResponse({
                    message: 'Role confirmed successfully',
                    user: sanitizeUser(updated),
                });
            }

            ensurePermission(actor, 'user.assign_role');
            const nextRoleCode = resolveIncomingRole(body);
            assertCanAssignRole(actor, nextRoleCode);

            const existingRows = await sql`
                SELECT id, role_code, system_role, job_title
                FROM users
                WHERE id = ${id}
                LIMIT 1
            `;
            if (existingRows.length === 0) return errorResponse('User not found', 404);

            const existing = existingRows[0];
            const status = actor.role_code === 'DIRECTOR' ? 'confirmed' : 'pending_reassignment';

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);

                await tx`
                    UPDATE users
                    SET
                        role_code = ${nextRoleCode},
                        role_assignment_status = ${status},
                        role_confirmed_by_user_id = ${status === 'confirmed' ? actor.id : null},
                        role_confirmed_at = ${status === 'confirmed' ? new Date().toISOString() : null}
                    WHERE id = ${id}
                `;

                await tx`
                    INSERT INTO user_role_history (
                        user_id,
                        previous_role_code,
                        new_role_code,
                        changed_by_user_id,
                        reason
                    )
                    VALUES (
                        ${id},
                        ${existing.role_code},
                        ${nextRoleCode},
                        ${actor.id},
                        ${body.reason || 'Role update'}
                    )
                `;
            });

            return successResponse({ message: 'Role updated successfully' });
        }

        // PUT - Update user details
        if (method === 'PUT') {
            if (!id) return errorResponse('User ID is required', 400);
            ensurePermission(actor, 'user.update');

            const { name, email, password } = body;
            if (!name || !email) {
                return errorResponse('Name and email are required', 400);
            }

            const existingRows = await sql`
                SELECT id, role_code, system_role, job_title
                FROM users
                WHERE id = ${id}
                LIMIT 1
            `;
            if (existingRows.length === 0) return errorResponse('User not found', 404);

            const existing = existingRows[0];
            const nextRoleCode = body.role || body.role_code
                ? resolveIncomingRole(body)
                : existing.role_code;
            const nextSystemRole = body.system_role || body.systemRole || existing.system_role || resolveSystemRole(nextRoleCode);
            const nextJobTitle = body.job_title || body.jobTitle || existing.job_title || nextRoleCode;
            
            assertCanAssignRole(actor, nextRoleCode);

            const requireReset =
                body.require_password_reset === true || body.requirePasswordReset === true;

            const updated = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);

                if (password && String(password).trim() !== '') {
                    const passwordHash = await hashPassword(password);
                    await tx`
                        UPDATE users
                        SET
                            name = ${name},
                            email = ${email},
                            role_code = ${nextRoleCode},
                            system_role = ${nextSystemRole},
                            job_title = ${nextJobTitle},
                            role_assignment_status = ${actor.role_code === 'DIRECTOR' ? 'confirmed' : 'pending_reassignment'},
                            role_confirmed_by_user_id = ${actor.role_code === 'DIRECTOR' ? actor.id : null},
                            role_confirmed_at = ${actor.role_code === 'DIRECTOR' ? new Date().toISOString() : null},
                            password_hash = ${passwordHash},
                            require_password_reset = ${requireReset}
                        WHERE id = ${id}
                    `;
                } else {
                    await tx`
                        UPDATE users
                        SET
                            name = ${name},
                            email = ${email},
                            role_code = ${nextRoleCode},
                            system_role = ${nextSystemRole},
                            job_title = ${nextJobTitle},
                            role_assignment_status = ${actor.role_code === 'DIRECTOR' ? 'confirmed' : 'pending_reassignment'},
                            role_confirmed_by_user_id = ${actor.role_code === 'DIRECTOR' ? actor.id : null},
                            role_confirmed_at = ${actor.role_code === 'DIRECTOR' ? new Date().toISOString() : null},
                            require_password_reset = ${requireReset}
                        WHERE id = ${id}
                    `;
                }

                const rows = await tx`
                    SELECT
                        id,
                        name,
                        email,
                        role_code,
                        system_role,
                        job_title,
                        profile_picture_url,
                        role_assignment_status,
                        role_confirmed_at,
                        require_password_reset,
                        last_login,
                        created_at
                    FROM users
                    WHERE id = ${id}
                    LIMIT 1
                `;
                return rows[0];
            });

            return successResponse({
                message: 'User updated successfully',
                user: sanitizeUser(updated),
            });
        }

        // DELETE - Delete user
        if (method === 'DELETE') {
            if (!id) return errorResponse('User ID is required', 400);
            ensurePermission(actor, 'user.delete');

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`DELETE FROM users WHERE id = ${id}`;
            });

            return successResponse({ message: 'User deleted successfully' });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Users function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
