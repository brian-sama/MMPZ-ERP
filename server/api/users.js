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
import { buildIdentity } from './utils/identity.js';
import { syncFacilitatorProfileForUser } from './utils/facilitators.js';

const getUserColumns = async () => {
    const rows = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users'
    `;
    return new Set(rows.map((row) => row.column_name));
};

const buildUserSelect = (columns) => {
    const has = (column) => columns.has(column);
    const value = (column, fallback) =>
        has(column)
            ? `u.${column}`
            : fallback;

    return sql.unsafe(`
        u.id,
        u.name,
        u.email,
        ${value('role_code', 'NULL::text')} AS role_code,
        ${value('system_role', 'NULL::text')} AS system_role,
        ${value('job_title', 'NULL::text')} AS job_title,
        ${value('short_bio', "''::text")} AS short_bio,
        ${value('profile_picture_url', 'NULL::text')} AS profile_picture_url,
        ${value('role_assignment_status', "'confirmed'::text")} AS role_assignment_status,
        ${value('role_confirmed_at', 'NULL::timestamp')} AS role_confirmed_at,
        ${value('require_password_reset', 'FALSE')} AS require_password_reset,
        ${value('last_login', 'NULL::timestamp')} AS last_login,
        ${value('failed_login_attempts', '0')} AS failed_login_attempts,
        ${value('locked_at', 'NULL::timestamp')} AS locked_at,
        ${value('phone', "''::text")} AS phone,
        ${value('created_at', 'CURRENT_TIMESTAMP')} AS created_at
    `);
};

const sanitizeUser = (user) => {
    const systemRole = resolveSystemRole(user.role_code, user.system_role);
    const identity = buildIdentity(user, { systemRole });

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role_code: user.role_code,
        system_role: systemRole,
        job_title: identity.displayTitle,
        department: identity.department,
        employment_type: identity.employmentType,
        identity,
        short_bio: user.short_bio || '',
        profile_picture_url: user.profile_picture_url || null,
        phone: user.phone || '',
        role_assignment_status: user.role_assignment_status,
        role_confirmed_at: user.role_confirmed_at,
        role: toLegacyRole(user.role_code, systemRole),
        require_password_reset: user.require_password_reset,
        last_login: user.last_login,
        failed_login_attempts: user.failed_login_attempts || 0,
        locked_at: user.locked_at || null,
        created_at: user.created_at,
    };
};

const sanitizeDirectoryUser = (user) => {
    const systemRole = resolveSystemRole(user.role_code, user.system_role);
    const identity = buildIdentity(user, { systemRole });

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role_code: user.role_code,
        system_role: systemRole,
        job_title: identity.displayTitle,
        department: identity.department,
        employment_type: identity.employmentType,
        identity,
        short_bio: user.short_bio || '',
        profile_picture_url: user.profile_picture_url || null,
        phone: user.phone || '',
        role_assignment_status: user.role_assignment_status,
        created_at: user.created_at,
    };
};

const assertCanAssignRole = (actor, targetRoleCode) => {
    if (actor.system_role === 'SUPER_ADMIN') return;
    if (targetRoleCode === 'DIRECTOR' && actor.role_code !== 'DIRECTOR') {
        throw new HttpError('Only Director can create or assign Director role', 403);
    }
};

const canConfirmRoleImmediately = (actor) =>
    actor.role_code === 'DIRECTOR' || actor.system_role === 'SUPER_ADMIN';

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

        console.log('[USERS API] Request - method:', method, 'actor:', actor?.id, actor?.role_code, actor?.system_role);

        // GET - List users
        if (method === 'GET') {
            console.log('[USERS API] GET /users - actor:', actor?.id, actor?.role_code, actor?.system_role);
            const userColumns = await getUserColumns();
            const selectList = buildUserSelect(userColumns);
            const data = await sql`
                SELECT
                    ${selectList}
                FROM users u
                ORDER BY u.created_at DESC NULLS LAST, u.id DESC
            `;
            console.log('[USERS API] Raw data count:', data.length);

            if (hasPermission(actor, 'user.view')) {
                const sanitized = data.map(sanitizeUser);
                console.log('[USERS API] Returning with user.view permission, count:', sanitized.length);
                return successResponse(sanitized);
            }

            const sanitized = data.map(sanitizeDirectoryUser);
            console.log('[USERS API] Returning directory view, count:', sanitized.length);
            return successResponse(sanitized);
        }

        // POST - Create user
        if (method === 'POST') {
            ensurePermission(actor, 'user.create');
            console.log('[USERS API] POST /users - actor:', actor?.id, actor?.role_code, actor?.system_role);

            const { name, email, password } = body;
            if (!name || !email || !password) {
                return errorResponse('Missing required fields: name, email, password', 400);
            }

            const roleCode = resolveIncomingRole(body);
            const systemRole = body.system_role || body.systemRole || resolveSystemRole(roleCode);
            const jobTitle =
                body.job_title ||
                body.jobTitle ||
                buildIdentity({ role_code: roleCode, name }, { systemRole }).displayTitle;

            assertCanAssignRole(actor, roleCode);

            const passwordHash = await hashPassword(password);
            const requireReset =
                body.require_password_reset === true || body.requirePasswordReset === true;

            const roleStatus = (roleCode === 'DIRECTOR' && actor.role_code === 'DIRECTOR') ||
                                 actor.system_role === 'SUPER_ADMIN'
                ? 'confirmed'
                : 'pending_reassignment';

            const userColumns = await getUserColumns();

            const inserted = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);

                // Insert only the columns guaranteed to exist in every deployment
                const created = await tx`
                    INSERT INTO users (
                        name,
                        email,
                        password_hash,
                        role_code,
                        system_role,
                        job_title,
                        short_bio,
                        role_assignment_status,
                        role_confirmed_by_user_id,
                        role_confirmed_at,
                        require_password_reset
                    )
                    VALUES (
                        ${name},
                        ${email},
                        ${passwordHash},
                        ${roleCode},
                        ${systemRole},
                        ${jobTitle},
                        ${body.short_bio || body.shortBio || null},
                        ${roleStatus},
                        ${roleStatus === 'confirmed' ? actor.id : null},
                        ${roleStatus === 'confirmed' ? new Date().toISOString() : null},
                        ${requireReset}
                    )
                    RETURNING id, name, email, role_code, system_role, job_title,
                              short_bio, profile_picture_url, role_assignment_status,
                              role_confirmed_at, require_password_reset, last_login, created_at
                `;

                const userId = created[0].id;

                // Apply optional columns only if they exist in this deployment's schema
                if (userColumns.has('phone') && (body.phone || null) !== null) {
                    await tx`UPDATE users SET phone = ${body.phone} WHERE id = ${userId}`;
                }
                if (userColumns.has('role_legacy_snapshot')) {
                    await tx`UPDATE users SET role_legacy_snapshot = ${body.role || null} WHERE id = ${userId}`;
                }

                await syncFacilitatorProfileForUser(tx, created[0]);

                // user_role_history is optional — skip if the table doesn't exist yet
                const hasRoleHistory = await tx`
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = current_schema() AND table_name = 'user_role_history'
                    ) AS exists
                `;
                if (hasRoleHistory[0]?.exists) {
                    await tx`
                        INSERT INTO user_role_history (
                            user_id, previous_role_code, new_role_code, changed_by_user_id, reason
                        )
                        VALUES (${userId}, ${null}, ${roleCode}, ${actor.id}, ${'Initial role assignment'})
                    `;
                }

                return created[0];
            });

            // Fire-and-forget: notify M&E so it can create the matching ErpReference entry.
            // Does not block the user creation response if M&E is unreachable.
            const meApiBase = (process.env.ME_INTERNAL_API_URL ?? '').replace(/\/api\/?$/, '').replace(/\/+$/, '');
            const meToken = process.env.ME_INTEGRATION_TOKEN;
            if (meApiBase && meToken) {
                fetch(`${meApiBase}/api/integration/users/push`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${meToken}` },
                    body: JSON.stringify({ action: 'upsert', users: [sanitizeUser(inserted)] }),
                }).catch(() => {});
            }

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
                            system_role = ${resolveSystemRole(finalRoleCode)},
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
                            short_bio,
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
                    await syncFacilitatorProfileForUser(tx, rows[0]);
                    return rows[0];
                });

                return successResponse({
                    message: 'Role confirmed successfully',
                    user: sanitizeUser(updated),
                });
            }

            if (path.endsWith('/unlock')) {
                ensurePermission(actor, 'user.update');
                await sql`
                    UPDATE users 
                    SET failed_login_attempts = 0, 
                        locked_at = NULL 
                    WHERE id = ${id}
                `;
                return successResponse({ message: 'Account unlocked successfully' });
            }

            ensurePermission(actor, 'user.assign_role');
            const nextRoleCode = resolveIncomingRole(body);
            assertCanAssignRole(actor, nextRoleCode);

            const existingRows = await sql`
                SELECT id, role_code, system_role, job_title, short_bio, created_at
                FROM users
                WHERE id = ${id}
                LIMIT 1
            `;
            if (existingRows.length === 0) return errorResponse('User not found', 404);

            const existing = existingRows[0];
            const status = canConfirmRoleImmediately(actor) ? 'confirmed' : 'pending_reassignment';

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);

                await tx`
                    UPDATE users
                    SET
                        role_code = ${nextRoleCode},
                        system_role = ${resolveSystemRole(nextRoleCode)},
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

                await syncFacilitatorProfileForUser(tx, {
                    id: existing.id,
                    role_code: nextRoleCode,
                    system_role: resolveSystemRole(nextRoleCode),
                    created_at: existing.created_at,
                });
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
                SELECT id, role_code, system_role, job_title, short_bio, created_at
                FROM users
                WHERE id = ${id}
                LIMIT 1
            `;
            if (existingRows.length === 0) return errorResponse('User not found', 404);

            const existing = existingRows[0];
            const nextRoleCode = body.role || body.role_code
                ? resolveIncomingRole(body)
                : existing.role_code;
            const nextSystemRole = body.system_role || body.systemRole || resolveSystemRole(nextRoleCode);
            const nextJobTitle = body.job_title || body.jobTitle || existing.job_title || nextRoleCode;
            const nextShortBio =
                body.short_bio !== undefined || body.shortBio !== undefined
                    ? body.short_bio || body.shortBio
                    : existing.short_bio;
            
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
                            short_bio = ${nextShortBio || null},
                            role_assignment_status = ${canConfirmRoleImmediately(actor) ? 'confirmed' : 'pending_reassignment'},
                            role_confirmed_by_user_id = ${canConfirmRoleImmediately(actor) ? actor.id : null},
                            role_confirmed_at = ${canConfirmRoleImmediately(actor) ? new Date().toISOString() : null},
                            password_hash = ${passwordHash},
                            require_password_reset = ${requireReset},
                            phone = ${body.phone !== undefined ? body.phone : existing.phone},
                            failed_login_attempts = 0,
                            locked_at = NULL
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
                            short_bio = ${nextShortBio || null},
                            role_assignment_status = ${canConfirmRoleImmediately(actor) ? 'confirmed' : 'pending_reassignment'},
                            role_confirmed_by_user_id = ${canConfirmRoleImmediately(actor) ? actor.id : null},
                            role_confirmed_at = ${canConfirmRoleImmediately(actor) ? new Date().toISOString() : null},
                            require_password_reset = ${requireReset},
                            phone = ${body.phone !== undefined ? body.phone : existing.phone},
                            failed_login_attempts = 0,
                            locked_at = NULL
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
                        short_bio,
                        profile_picture_url,
                        phone,
                        role_assignment_status,
                        role_confirmed_at,
                        require_password_reset,
                        last_login,
                        failed_login_attempts,
                        locked_at,
                        created_at
                    FROM users
                    WHERE id = ${id}
                    LIMIT 1
                `;
                await syncFacilitatorProfileForUser(tx, rows[0]);
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
