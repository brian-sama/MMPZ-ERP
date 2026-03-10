import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
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
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            const { indicator_id, period } = query;

            // 1. If dashboard summary requested
            if (event.path.includes('/summary')) {
                const performance = await sql`
                    SELECT 
                        reporting_period,
                        SUM(value) as total_reached,
                        (SELECT SUM(target_value) FROM indicator_targets WHERE reporting_period = ip.reporting_period) as total_target
                    FROM indicator_progress ip
                    WHERE status = 'approved'
                    GROUP BY reporting_period
                    ORDER BY reporting_period DESC
                    LIMIT 6
                `;
                return successResponse(performance);
            }

            // 2. detailed progress for an indicator
            if (indicator_id) {
                const targets = await sql`
                    SELECT * FROM indicator_targets 
                    WHERE indicator_id = ${indicator_id} 
                    ORDER BY reporting_period ASC
                `;
                const progress = await sql`
                    SELECT * FROM indicator_progress 
                    WHERE indicator_id = ${indicator_id} 
                    ORDER BY created_at DESC
                `;
                return successResponse({ targets, progress });
            }

            return errorResponse('Missing parameters', 400);
        }

        if (method === 'POST') {
            ensurePermission(actor, 'indicator.update');
            const { indicator_id, reporting_period, value, notes } = body;

            if (!indicator_id || !reporting_period || value === undefined) {
                return errorResponse('indicator_id, reporting_period, and value are required', 400);
            }

            const result = await sql.begin(async (tx) => {
                // Find or create target
                let target = await tx`
                    SELECT id FROM indicator_targets 
                    WHERE indicator_id = ${indicator_id} AND reporting_period = ${reporting_period}
                `;

                if (target.length === 0) {
                    target = await tx`
                        INSERT INTO indicator_targets (indicator_id, reporting_period, target_value)
                        VALUES (${indicator_id}, ${reporting_period}, 0)
                        RETURNING id
                    `;
                }

                const ip = await tx`
                    INSERT INTO indicator_progress (indicator_id, target_id, reporting_period, value, notes, reported_by_user_id)
                    VALUES (${indicator_id}, ${target[0].id}, ${reporting_period}, ${value}, ${notes || null}, ${actor.id})
                    RETURNING *
                `;

                // Update the main indicator current_value (additive)
                await tx`
                    UPDATE indicators 
                    SET current_value = current_value + ${value}, last_updated = CURRENT_TIMESTAMP
                    WHERE id = ${indicator_id}
                `;

                return ip[0];
            });

            return successResponse({ message: 'Progress reported successfully', progress: result });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('ME function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
