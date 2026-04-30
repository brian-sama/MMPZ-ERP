import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    ensureAnyPermission,
    canSeeOrganizationIndicators,
} from './utils/rbac.js';

const hasTable = async (tableName) => {
    const rows = await sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = ${tableName}
        ) AS exists
    `;
    return Boolean(rows[0]?.exists);
};

const indicatorScopeFilter = (actor, alias = 'i') => {
    if (canSeeOrganizationIndicators(actor)) return '';
    const actorId = Number(actor.id);
    return `
        AND (
            ${alias}.created_by_user_id = ${actorId}
            OR EXISTS (
                SELECT 1
                FROM project_assignments pa
                WHERE pa.project_id = ${alias}.project_id
                  AND pa.user_id = ${actorId}
                  AND pa.is_active = TRUE
            )
        )
    `;
};

const ensureIndicatorAccess = async (actor, indicatorId) => {
    if (canSeeOrganizationIndicators(actor)) return;
    const rows = await sql`
        SELECT i.id
        FROM indicators i
        LEFT JOIN project_assignments pa
          ON pa.project_id = i.project_id
         AND pa.user_id = ${actor.id}
         AND pa.is_active = TRUE
        WHERE i.id = ${indicatorId}
          AND (i.created_by_user_id = ${actor.id} OR pa.id IS NOT NULL)
        LIMIT 1
    `;
    if (rows.length === 0) {
        throw new HttpError('Permission denied', 403);
    }
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            ensureAnyPermission(actor, ['indicator.read_all', 'indicator.read_assigned', 'project.read'], {
                allowPending: true,
            });
            const { indicator_id, period } = query;

            // 1. If dashboard summary requested
            if (event.path.includes('/summary')) {
                if (!(await hasTable('indicator_progress')) || !(await hasTable('indicator_targets'))) {
                    return successResponse([]);
                }
                const performance = await sql.unsafe(`
                    SELECT 
                        reporting_period,
                        SUM(value) as total_reached,
                        (
                            SELECT SUM(it.target_value)
                            FROM indicator_targets it
                            JOIN indicators ti ON ti.id = it.indicator_id
                            WHERE it.reporting_period = ip.reporting_period
                            ${indicatorScopeFilter(actor, 'ti')}
                        ) as total_target
                    FROM indicator_progress ip
                    JOIN indicators i ON i.id = ip.indicator_id
                    WHERE ip.status = 'approved'
                    ${indicatorScopeFilter(actor, 'i')}
                    GROUP BY reporting_period
                    ORDER BY reporting_period DESC
                    LIMIT 6
                `);
                return successResponse(performance);
            }

            // 2. detailed progress for an indicator
            if (indicator_id) {
                if (!(await hasTable('indicator_targets')) || !(await hasTable('indicator_progress'))) {
                    return successResponse({ targets: [], progress: [] });
                }
                await ensureIndicatorAccess(actor, indicator_id);
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
            await ensureIndicatorAccess(actor, indicator_id);

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
