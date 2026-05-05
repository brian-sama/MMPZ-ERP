import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const query = getQueryParams(event);
        const userId = getRequestUserId(event) || query.userId;
        const actor = await getUserContext(userId);

        if (method === 'GET') {
            // Fetch leave balance for the current user
            const balances = await sql`
                SELECT * FROM leave_balances WHERE user_id = ${actor.id} LIMIT 1
            `;
            
            let balance = balances[0];
            if (!balance) {
                // Initialize if not exists
                [balance] = await sql`
                    INSERT INTO leave_balances (user_id)
                    VALUES (${actor.id})
                    RETURNING *
                `;
            }

            // Fetch recent leave history
            const history = await sql`
                SELECT id, title, status, metadata, created_at, updated_at
                FROM unified_submissions
                WHERE submitter_user_id = ${actor.id}
                  AND submission_type = 'leave_application'
                ORDER BY created_at DESC
                LIMIT 10
            `;

            return successResponse({ balance, history });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Leave function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
