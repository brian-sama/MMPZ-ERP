import { sql } from './utils/db.js';
import {
    successResponse,
    errorResponse,
    corsResponse,
    parseBody,
    getPathParam,
} from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    hasPermission,
    setAuditActor,
} from './utils/rbac.js';

const getAccessibleIndicatorClause = (actor) => sql`
    (
        i.created_by_user_id = ${actor.id}
        OR EXISTS (
            SELECT 1
            FROM project_assignments pa
            WHERE pa.project_id = i.project_id
              AND pa.user_id = ${actor.id}
              AND pa.is_active = TRUE
        )
    )
`;

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const id = getPathParam(event, 'id') || getPathParam(event, 'activities');
        const indicatorId = getPathParam(event, 'indicators');
        const body = parseBody(event);
        const actor = await getUserContext(getRequestUserId(event, body));

        // GET - list activities
        if (method === 'GET') {
            ensurePermission(actor, 'activity.read', { allowPending: true });

            let query = sql`
                SELECT
                    a.*,
                    i.title AS indicator_title
                FROM activities a
                LEFT JOIN indicators i ON a.indicator_id = i.id
                WHERE 1=1
            `;

            if (indicatorId) {
                query = sql`${query} AND a.indicator_id = ${indicatorId}`;
            }

            if (!actor.is_pending_reassignment && hasPermission(actor, 'indicator.read_all')) {
                query = sql`${query} ORDER BY a.activity_date DESC`;
            } else {
                const scope = getAccessibleIndicatorClause(actor);
                query = sql`${query} AND ${scope} ORDER BY a.activity_date DESC`;
            }

            const rows = await query;
            return successResponse(rows);
        }

        // POST - create activity
        if (method === 'POST') {
            ensurePermission(actor, 'activity.create');

            const { indicator_id, description, category, cost, project_id, assigned_user_id, evidence_url, activity_output } = body;
            if (!indicator_id || !description || cost === undefined) {
                return errorResponse('Missing required fields', 400);
            }

            const indicators = await sql`
                SELECT id, title, created_by_user_id, project_id, total_budget, current_budget_balance
                FROM indicators
                WHERE id = ${indicator_id}
                LIMIT 1
            `;
            if (indicators.length === 0) return errorResponse('Indicator not found', 404);
            const indicator = indicators[0];

            if (!hasPermission(actor, 'indicator.read_all')) {
                const canAccess = indicator.created_by_user_id === actor.id || (await sql`
                    SELECT id
                    FROM project_assignments
                    WHERE project_id = ${indicator.project_id}
                      AND user_id = ${actor.id}
                      AND is_active = TRUE
                    LIMIT 1
                `).length > 0;

                if (!canAccess) return errorResponse('Permission denied', 403);
            }

            const numericCost = Number.parseFloat(cost);
            if (Number.isNaN(numericCost) || numericCost < 0) {
                return errorResponse('Invalid cost value', 400);
            }

            const result = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);

                const inserted = await tx`
                    INSERT INTO activities (
                        indicator_id,
                        project_id,
                        assigned_user_id,
                        description,
                        activity_output,
                        evidence_url,
                        category,
                        cost
                    )
                    VALUES (
                        ${indicator_id},
                        ${project_id || indicator.project_id || null},
                        ${assigned_user_id || null},
                        ${description},
                        ${activity_output || null},
                        ${evidence_url || null},
                        ${category || 'other'},
                        ${numericCost}
                    )
                    RETURNING *
                `;

                await tx`
                    UPDATE indicators
                    SET
                        current_budget_balance = current_budget_balance - ${numericCost},
                        last_updated = ${new Date().toISOString()}
                    WHERE id = ${indicator_id}
                `;

                const updatedIndicator = await tx`
                    SELECT total_budget, current_budget_balance
                    FROM indicators
                    WHERE id = ${indicator_id}
                    LIMIT 1
                `;

                return {
                    activity: inserted[0],
                    indicator: updatedIndicator[0],
                };
            });

            const budget = result.indicator;
            const threshold = budget.total_budget > 0
                ? Number((Number(budget.current_budget_balance) / Number(budget.total_budget)) * 100)
                : 0;

            const response = {
                message: 'Activity created successfully',
                activity: result.activity,
            };

            if (threshold < 20) {
                response.budgetWarning = `Indicator budget is below 20% (${threshold.toFixed(1)}% remaining).`;
            }

            return successResponse(response);
        }

        // DELETE - delete activity
        if (method === 'DELETE') {
            if (!id) return errorResponse('Activity ID is required', 400);
            ensurePermission(actor, 'activity.delete');

            const activities = await sql`
                SELECT id, indicator_id, cost
                FROM activities
                WHERE id = ${id}
                LIMIT 1
            `;
            if (activities.length === 0) return errorResponse('Activity not found', 404);

            const activity = activities[0];

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`DELETE FROM activities WHERE id = ${id}`;
                await tx`
                    UPDATE indicators
                    SET
                        current_budget_balance = current_budget_balance + ${activity.cost},
                        last_updated = ${new Date().toISOString()}
                    WHERE id = ${activity.indicator_id}
                `;
            });

            return successResponse({ message: 'Activity deleted successfully' });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Activities function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
