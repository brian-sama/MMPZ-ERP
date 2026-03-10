import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams, getPathParam } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const id = getPathParam(event, 'id') || getPathParam(event, 'facilitators');
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            // anyone with read permission
            let rows;
            if (id) {
                rows = await sql`
                    SELECT df.*, u.name, u.email
                    FROM development_facilitators df
                    JOIN users u ON df.user_id = u.id
                    WHERE df.user_id = ${id}
                `;
            } else {
                rows = await sql`
                    SELECT df.*, u.name, u.email,
                    (SELECT COUNT(*) FROM facilitator_assignments WHERE facilitator_user_id = df.user_id AND is_active = TRUE) as active_assignments
                    FROM development_facilitators df
                    JOIN users u ON df.user_id = u.id
                    ORDER BY u.name ASC
                `;
            }
            return successResponse(rows);
        }

        if (method === 'POST') {
            ensurePermission(actor, 'user.create'); // or specific facilitator role permission
            const { user_id, gender, age_bracket, phone, address, joined_at } = body;

            if (!user_id) return errorResponse('User ID is required', 400);

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
