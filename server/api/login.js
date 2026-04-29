// Login endpoint.
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody } from './utils/response.js';
import { comparePassword } from './utils/auth.js';
import { resolveSystemRole, toLegacyRole } from './utils/rbac.js';
import { issueSessionToken } from './utils/session-token.js';

const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000;
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_ATTEMPTS = 10;
const ipAttemptTracker = new Map();

const getUserColumns = async () => {
    const rows = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users'
    `;
    return new Set(rows.map((row) => row.column_name));
};

const getColumnExpression = (availableColumns, preferredName, fallbackExpression) =>
    availableColumns.has(preferredName) ? preferredName : `${fallbackExpression} AS ${preferredName}`;

const selectUserByEmail = async (email) => {
    const availableColumns = await getUserColumns();
    const selectColumns = [
        'id',
        'name',
        'email',
        availableColumns.has('role_code')
            ? 'role_code'
            : availableColumns.has('role')
                ? 'role AS role_code'
                : `'DEVELOPMENT_FACILITATOR' AS role_code`,
        getColumnExpression(availableColumns, 'system_role', 'NULL::text'),
        getColumnExpression(availableColumns, 'job_title', 'NULL::text'),
        getColumnExpression(availableColumns, 'short_bio', 'NULL::text'),
        getColumnExpression(availableColumns, 'profile_picture_url', 'NULL::text'),
        getColumnExpression(availableColumns, 'password_hash', 'NULL::text'),
        getColumnExpression(availableColumns, 'require_password_reset', 'FALSE'),
        getColumnExpression(availableColumns, 'failed_login_attempts', '0'),
        getColumnExpression(availableColumns, 'locked_at', 'NULL::timestamp'),
        getColumnExpression(availableColumns, 'role_assignment_status', `'pending_reassignment'`),
        getColumnExpression(availableColumns, 'role_confirmed_at', 'NULL::timestamp'),
    ];

    const query = `
        SELECT ${selectColumns.join(', ')}
        FROM users
        WHERE email = $1
        LIMIT 1
    `;

    const users = await sql.unsafe(query, [email]);
    return {
        availableColumns,
        users,
    };
};

const updateFailedLoginState = async (availableColumns, userId, nextAttempts, shouldLock) => {
    const updateParts = [];
    if (availableColumns.has('failed_login_attempts')) {
        updateParts.push(`failed_login_attempts = ${Number(nextAttempts)}`);
    }
    if (shouldLock && availableColumns.has('locked_at')) {
        updateParts.push('locked_at = CURRENT_TIMESTAMP');
    }
    if (updateParts.length === 0) return;

    await sql.unsafe(
        `UPDATE users SET ${updateParts.join(', ')} WHERE id = $1`,
        [userId]
    );
};

const updateSuccessfulLoginState = async (availableColumns, userId) => {
    const updateParts = [];
    if (availableColumns.has('last_login')) {
        updateParts.push('last_login = CURRENT_TIMESTAMP');
    }
    if (availableColumns.has('failed_login_attempts')) {
        updateParts.push('failed_login_attempts = 0');
    }
    if (availableColumns.has('locked_at')) {
        updateParts.push('locked_at = NULL');
    }
    if (updateParts.length === 0) return;

    await sql.unsafe(
        `UPDATE users SET ${updateParts.join(', ')} WHERE id = $1`,
        [userId]
    );
};

const getClientIp = (event) => {
    const headers = event?.headers || {};
    const forwardedFor =
        headers['x-forwarded-for'] ||
        headers['X-Forwarded-For'] ||
        headers['x-real-ip'] ||
        headers['X-Real-IP'] ||
        '';
    return String(forwardedFor).split(',')[0].trim() || 'unknown';
};

const getIpRecord = (ip) => {
    const now = Date.now();
    const current = ipAttemptTracker.get(ip);
    if (!current || now > current.resetAt) {
        const nextRecord = { attempts: 0, resetAt: now + IP_WINDOW_MS };
        ipAttemptTracker.set(ip, nextRecord);
        return nextRecord;
    }
    return current;
};

const ensureIpAllowed = (ip) => {
    const record = getIpRecord(ip);
    if (record.attempts >= IP_MAX_ATTEMPTS) {
        const retryAfterSeconds = Math.max(60, Math.ceil((record.resetAt - Date.now()) / 1000));
        return errorResponse(
            `Too many failed login attempts from this network. Try again in about ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
            429
        );
    }
    return null;
};

const recordIpFailure = (ip) => {
    const record = getIpRecord(ip);
    record.attempts += 1;
    ipAttemptTracker.set(ip, record);
};

const clearIpFailures = (ip) => {
    ipAttemptTracker.delete(ip);
};

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
        const clientIp = getClientIp(event);

        // Validate input
        if (!email || !password) {
            return errorResponse('Email and password are required', 400);
        }

        const ipLimitResponse = ensureIpAllowed(clientIp);
        if (ipLimitResponse) return ipLimitResponse;

        // Query user from PostgreSQL
        let users;
        let availableColumns;
        try {
            const result = await selectUserByEmail(email);
            users = result.users;
            availableColumns = result.availableColumns;
        } catch (dbError) {
            console.error('Database error:', dbError);
            return errorResponse('Database error', 500, dbError.message);
        }

        if (!users || users.length === 0) {
            recordIpFailure(clientIp);
            return errorResponse('Invalid email or password', 401);
        }

        const user = users[0];

        if (!user.password_hash) {
            return errorResponse('Login is not available because password hashes are missing for this user record.', 500);
        }

        // Check if account is locked
        if (user.locked_at) {
            const lockAgeMs = Date.now() - new Date(user.locked_at).getTime();
            if (Number.isFinite(lockAgeMs) && lockAgeMs >= ACCOUNT_LOCK_DURATION_MS) {
                await updateSuccessfulLoginState(availableColumns, user.id);
                user.locked_at = null;
                user.failed_login_attempts = 0;
            } else {
                return errorResponse(
                    'Account is temporarily locked due to multiple failed login attempts. Please try again later or contact a System Administrator.',
                    403
                );
            }
        }

        // Verify password
        const isValid = await comparePassword(password, user.password_hash);

        if (!isValid) {
            recordIpFailure(clientIp);
            const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
            
            if (newFailedAttempts >= 3) {
                await updateFailedLoginState(availableColumns, user.id, newFailedAttempts, true);
                return errorResponse('Account has been locked after 3 failed attempts. Please contact an administrator.', 403);
            } else {
                await updateFailedLoginState(availableColumns, user.id, newFailedAttempts, false);
                return errorResponse(`Invalid email or password. Attempt ${newFailedAttempts} of 3.`, 401);
            }
        }

        // Success: Reset failed attempts and update last_login
        const systemRole = resolveSystemRole(user.role_code, user.system_role);
        try {
            await updateSuccessfulLoginState(availableColumns, user.id);
            clearIpFailures(clientIp);
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
