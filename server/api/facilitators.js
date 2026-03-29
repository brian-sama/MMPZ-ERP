import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams, getPathParam } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
} from './utils/rbac.js';
import {
    backfillFacilitatorProfiles,
    ensureFacilitatorProfile,
    isFacilitatorUser,
} from './utils/facilitators.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const id = getPathParam(event, 'id') || getPathParam(event, 'facilitators');
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            await backfillFacilitatorProfiles(sql);
            // anyone with read permission
            let rows;
            if (id) {
                rows = await sql`
                    SELECT
                        u.id AS user_id,
                        u.name,
                        u.email,
                        u.job_title,
                        u.profile_picture_url,
                        df.gender,
                        df.age_bracket,
                        df.phone,
                        df.address,
                        COALESCE(df.status, 'active') AS status,
                        COALESCE(df.joined_at, u.created_at::date) AS joined_at,
                        df.created_at
                    FROM users u
                    LEFT JOIN development_facilitators df ON df.user_id = u.id
                    WHERE u.id = ${id}
                      AND (
                          u.role_code = 'DEVELOPMENT_FACILITATOR'
                          OR u.system_role = 'FACILITATOR'
                      )
                `;
            } else {
                rows = await sql`
                    SELECT
                        u.id AS user_id,
                        u.name,
                        u.email,
                        u.job_title,
                        u.profile_picture_url,
                        df.gender,
                        df.age_bracket,
                        df.phone,
                        df.address,
                        COALESCE(df.status, 'active') AS status,
                        COALESCE(df.joined_at, u.created_at::date) AS joined_at,
                        df.created_at,
                        (
                            SELECT COUNT(*)::int
                            FROM facilitator_assignments fa
                            WHERE fa.facilitator_user_id = u.id
                              AND fa.is_active = TRUE
                        ) AS active_assignments
                    FROM users u
                    LEFT JOIN development_facilitators df ON df.user_id = u.id
                    WHERE u.role_code = 'DEVELOPMENT_FACILITATOR'
                       OR u.system_role = 'FACILITATOR'
                    ORDER BY u.name ASC
                `;
            }
            return successResponse(rows);
        }

        if (method === 'POST') {
            ensurePermission(actor, 'user.create'); // or specific facilitator role permission
            const { user_id, gender, age_bracket, phone, address, joined_at } = body;

            if (!user_id) return errorResponse('User ID is required', 400);

            const userRows = await sql`
                SELECT id, role_code, system_role, created_at
                FROM users
                WHERE id = ${user_id}
                LIMIT 1
            `;
            if (userRows.length === 0) return errorResponse('User not found', 404);
            if (!isFacilitatorUser(userRows[0])) {
                return errorResponse('Selected user is not a development facilitator', 400);
            }

            await ensureFacilitatorProfile(sql, {
                userId: user_id,
                joinedAt: joined_at || userRows[0].created_at,
                activate: true,
            });

            const inserted = await sql`
                INSERT INTO development_facilitators (user_id, gender, age_bracket, phone, address, joined_at)
                VALUES (${user_id}, ${gender || null}, ${age_bracket || null}, ${phone || null}, ${address || null}, ${joined_at || new Date().toISOString()})
                ON CONFLICT (user_id) DO UPDATE SET
                    gender = EXCLUDED.gender,
                    age_bracket = EXCLUDED.age_bracket,
                    phone = EXCLUDED.phone,
                    address = EXCLUDED.address
                RETURNING *
            `;
            return successResponse({ message: 'Facilitator profile updated', facilitator: inserted[0] });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Facilitators function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
