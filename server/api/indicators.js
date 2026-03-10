import { sql } from './utils/db.js';
import {
    successResponse,
    errorResponse,
    corsResponse,
    parseBody,
    getQueryParams,
    getPathParam,
} from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    ensureAnyPermission,
    hasPermission,
    setAuditActor,
} from './utils/rbac.js';

const formatIndicator = (ind) => ({
    ...ind,
    progress_percentage:
        ind.target_value > 0
            ? Math.round((Number(ind.current_value) / Number(ind.target_value)) * 100)
            : 0,
});

const canAccessIndicator = async (actor, indicator) => {
    if (!indicator) return false;
    if (!actor.is_pending_reassignment && hasPermission(actor, 'indicator.read_all')) return true;
    if (indicator.created_by_user_id === actor.id) return true;
    if (!indicator.project_id) return false;

    const assignments = await sql`
        SELECT id
        FROM project_assignments
        WHERE project_id = ${indicator.project_id}
          AND user_id = ${actor.id}
          AND is_active = TRUE
        LIMIT 1
    `;
    return assignments.length > 0;
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const id = getPathParam(event, 'id') || getPathParam(event, 'indicators');
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actorUserId = getRequestUserId(event, body);
        const actor = await getUserContext(actorUserId);

        // GET - List or details
        if (method === 'GET') {
            ensureAnyPermission(actor, ['indicator.read_all', 'indicator.read_assigned', 'project.read'], {
                allowPending: true,
            });

            if (id) {
                const indicators = await sql`
                    SELECT i.*, u.name AS owner_name
                    FROM indicators i
                    LEFT JOIN users u ON i.created_by_user_id = u.id
                    WHERE i.id = ${id}
                    LIMIT 1
                `;
                if (indicators.length === 0) return errorResponse('Indicator not found', 404);

                const allowed = await canAccessIndicator(actor, indicators[0]);
                if (!allowed) return errorResponse('Permission denied', 403);

                return successResponse(formatIndicator(indicators[0]));
            }

            let indicatorsQuery = sql`
                SELECT i.*, u.name AS owner_name
                FROM indicators i
                LEFT JOIN users u ON i.created_by_user_id = u.id
                WHERE 1=1
            `;

            const search = query.search || null;
            const status = query.status || null;
            const priority = query.priority || null;

            // Pending reassignment users are always restricted to own/assigned scope.
            const shouldRestrictScope =
                actor.is_pending_reassignment || !hasPermission(actor, 'indicator.read_all');

            if (shouldRestrictScope) {
                indicatorsQuery = sql`${indicatorsQuery}
                    AND (
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
            }

            if (search) indicatorsQuery = sql`${indicatorsQuery} AND i.title ILIKE ${`%${search}%`}`;
            if (status) indicatorsQuery = sql`${indicatorsQuery} AND i.status = ${status}`;
            if (priority) indicatorsQuery = sql`${indicatorsQuery} AND i.priority = ${priority}`;

            indicatorsQuery = sql`${indicatorsQuery} ORDER BY i.created_at DESC`;
            const rows = await indicatorsQuery;
            return successResponse(rows.map(formatIndicator));
        }

        // POST - Create indicator
        if (method === 'POST') {
            ensurePermission(actor, 'indicator.create');

            const title = body.title;
            const targetValue =
                body.target_value !== undefined ? body.target_value : body.target;
            const budget =
                body.total_budget !== undefined ? body.total_budget : body.budget;

            if (!title || targetValue === undefined || budget === undefined) {
                return errorResponse(
                    'Missing required fields: title, target/target_value, budget/total_budget',
                    400
                );
            }

            const inserted = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                const rows = await tx`
                    INSERT INTO indicators (
                        project_id,
                        title,
                        target_value,
                        current_value,
                        total_budget,
                        current_budget_balance,
                        created_by_user_id,
                        priority,
                        status,
                        reporting_period_start,
                        reporting_period_end
                    )
                    VALUES (
                        ${body.project_id || null},
                        ${title},
                        ${targetValue},
                        0,
                        ${budget},
                        ${budget},
                        ${actor.id},
                        ${body.priority || 'medium'},
                        'active',
                        ${body.reporting_period_start || null},
                        ${body.reporting_period_end || null}
                    )
                    RETURNING *
                `;
                return rows[0];
            });

            return successResponse({
                message: 'Indicator created successfully',
                indicator: formatIndicator(inserted),
            });
        }

        // PUT - Update indicator
        if (method === 'PUT') {
            if (!id) return errorResponse('Indicator ID is required', 400);
            ensurePermission(actor, 'indicator.update');

            const indicators = await sql`SELECT * FROM indicators WHERE id = ${id} LIMIT 1`;
            if (indicators.length === 0) return errorResponse('Indicator not found', 404);

            const indicator = indicators[0];
            const allowed = await canAccessIndicator(actor, indicator);
            if (!allowed) return errorResponse('Permission denied', 403);

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`
                    UPDATE indicators
                    SET
                        project_id = COALESCE(${body.project_id}, project_id),
                        title = COALESCE(${body.title}, title),
                        target_value = COALESCE(${body.target_value}, target_value),
                        total_budget = COALESCE(${body.total_budget}, total_budget),
                        current_budget_balance = COALESCE(${body.current_budget_balance}, current_budget_balance),
                        priority = COALESCE(${body.priority}, priority),
                        status = COALESCE(${body.status}, status),
                        reporting_period_start = COALESCE(${body.reporting_period_start}, reporting_period_start),
                        reporting_period_end = COALESCE(${body.reporting_period_end}, reporting_period_end),
                        last_updated = ${new Date().toISOString()}
                    WHERE id = ${id}
                `;
            });

            return successResponse({ message: 'Indicator updated successfully' });
        }

        // DELETE - Delete indicator
        if (method === 'DELETE') {
            if (!id) return errorResponse('Indicator ID is required', 400);
            ensurePermission(actor, 'indicator.delete');

            const indicators = await sql`SELECT * FROM indicators WHERE id = ${id} LIMIT 1`;
            if (indicators.length === 0) return errorResponse('Indicator not found', 404);

            const allowed = await canAccessIndicator(actor, indicators[0]);
            if (!allowed) return errorResponse('Permission denied', 403);

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`DELETE FROM indicators WHERE id = ${id}`;
            });

            return successResponse({ message: 'Indicator deleted successfully' });
        }

        // PATCH - mark complete
        if (method === 'PATCH') {
            if (!id) return errorResponse('Indicator ID is required', 400);
            if (!event.path?.endsWith('/complete')) return errorResponse('Unsupported patch action', 400);

            ensurePermission(actor, 'indicator.complete');

            const indicators = await sql`SELECT * FROM indicators WHERE id = ${id} LIMIT 1`;
            if (indicators.length === 0) return errorResponse('Indicator not found', 404);

            const allowed = await canAccessIndicator(actor, indicators[0]);
            if (!allowed) return errorResponse('Permission denied', 403);

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`UPDATE indicators SET status = 'completed', last_updated = ${new Date().toISOString()} WHERE id = ${id}`;
            });

            return successResponse({ message: 'Indicator marked as completed' });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Indicators function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
