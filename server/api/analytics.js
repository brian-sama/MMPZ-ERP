import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    canSeeOrganizationIndicators,
} from './utils/rbac.js';

const canSeeAllIndicators = (actor) =>
    canSeeOrganizationIndicators(actor);

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

const getIndicatorColumns = async () => {
    const rows = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'indicators'
    `;
    return new Set(rows.map((row) => row.column_name));
};

const scopedIndicatorFilter = async (actor) => {
    if (canSeeAllIndicators(actor)) return '';

    const hasAssignments = await hasTable('project_assignments');
    const indicatorCols = await getIndicatorColumns();
    const hasCreatedBy = indicatorCols.has('created_by_user_id');

    let filter = ' AND (';
    const conditions = [];

    if (hasCreatedBy) {
        conditions.push(`i.created_by_user_id = ${Number(actor.id)}`);
    }

    if (hasAssignments) {
        conditions.push(`EXISTS (
            SELECT 1
            FROM project_assignments pa
            WHERE pa.project_id = i.project_id
              AND pa.user_id = ${Number(actor.id)}
              AND pa.is_active = TRUE
        )`);
    }

    if (conditions.length === 0) return '';
    
    return ` AND (${conditions.join(' OR ')})`;
};

const riskLevel = (score) => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
};

const calculateRisk = (row) => {
    const progress = Number(row.progress_percentage || 0);
    const budgetUsed = Number(row.budget_utilization_percent || 0);
    const daysSinceUpdate = Number(row.days_since_update || 0);
    const velocity = Number(row.velocity || 0);
    let score = 0;

    if (progress < 50 && budgetUsed > 80) score += 50;
    if (daysSinceUpdate > 30) score += 30;
    if (velocity <= 0 && progress < 100) score += 20;
    if (row.status === 'flagged') score += 20;
    if (row.priority === 'critical') score += 10;

    return Math.min(score, 100);
};

const loadRiskRows = async (actor) => {
    const indicatorCols = await getIndicatorColumns();
    const filter = await scopedIndicatorFilter(actor);

    // Build resilient column selections
    const lastUpdatedCol = indicatorCols.has('last_updated') ? 'i.last_updated' : 'NULL::timestamp';
    const createdAtCol = indicatorCols.has('created_at') ? 'i.created_at' : 'CURRENT_TIMESTAMP';

    const rows = await sql.unsafe(`
        WITH latest_update AS (
            SELECT
                indicator_id,
                MAX(update_date) AS last_progress_update,
                MIN(update_date) AS first_progress_update,
                MIN(previous_value) AS first_value,
                MAX(new_value) AS latest_value
            FROM progress_updates
            GROUP BY indicator_id
        ),
        activity_spend AS (
            SELECT indicator_id, COALESCE(SUM(cost), 0)::float AS activity_spent
            FROM activities
            GROUP BY indicator_id
        )
        SELECT
            i.id,
            i.title,
            i.status,
            i.priority,
            i.target_value,
            i.current_value,
            i.total_budget::float AS total_budget,
            i.current_budget_balance::float AS current_budget_balance,
            COALESCE(a.activity_spent, GREATEST(i.total_budget - i.current_budget_balance, 0))::float AS spent_amount,
            CASE
                WHEN i.target_value > 0 THEN ROUND((COALESCE(i.current_value, 0)::float / i.target_value::float) * 100)
                ELSE 0
            END AS progress_percentage,
            CASE
                WHEN i.total_budget > 0 THEN ROUND(((i.total_budget - i.current_budget_balance)::float / i.total_budget::float) * 100)
                ELSE 0
            END AS budget_utilization_percent,
            GREATEST(
                EXTRACT(DAY FROM (NOW() - COALESCE(lu.last_progress_update, ${lastUpdatedCol}, ${createdAtCol}))),
                0
            )::int AS days_since_update,
            CASE
                WHEN lu.first_progress_update IS NOT NULL
                 AND lu.last_progress_update IS NOT NULL
                 AND EXTRACT(DAY FROM (lu.last_progress_update - lu.first_progress_update)) > 0
                    THEN ROUND(((COALESCE(lu.latest_value, i.current_value) - COALESCE(lu.first_value, 0))::numeric
                        / EXTRACT(DAY FROM (lu.last_progress_update - lu.first_progress_update))::numeric), 2)
                ELSE 0
            END::float AS velocity,
            p.name AS project_name,
            pr.name AS program_name
        FROM indicators i
        LEFT JOIN latest_update lu ON lu.indicator_id = i.id
        LEFT JOIN activity_spend a ON a.indicator_id = i.id
        LEFT JOIN projects p ON p.id = i.project_id
        LEFT JOIN programs pr ON pr.id = p.program_id
        WHERE COALESCE(i.status, 'active') != 'archived'
        ${filter}
        ORDER BY i.priority DESC, ${lastUpdatedCol} DESC NULLS LAST, ${createdAtCol} DESC
    `);

    return rows.map((row) => {
        const score = calculateRisk(row);
        const velocity = Number(row.velocity || 0);
        const remaining = Math.max(Number(row.target_value || 0) - Number(row.current_value || 0), 0);
        const estimatedDays = velocity > 0 && remaining > 0 ? Math.ceil(remaining / velocity) : null;

        return {
            ...row,
            auto_risk_score: score,
            risk_level: riskLevel(score),
            estimated_completion_days: estimatedDays,
            estimated_completion_date: estimatedDays
                ? new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000).toISOString()
                : null,
        };
    });
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();
    if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

    try {
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event) || query.userId);
        ensureAnyPermission(actor, ['indicator.read_all', 'indicator.read_assigned', 'project.read', 'activity.read'], {
            allowPending: true,
        });

        const path = event.path || '';
        const riskRows = await loadRiskRows(actor);

        if (path.includes('/multi-year')) {
            const filter = await scopedIndicatorFilter(actor);
            const indicatorCols = await getIndicatorColumns();
            const lastUpdatedCol = indicatorCols.has('last_updated') ? 'i.last_updated' : 'NULL::timestamp';
            const createdAtCol = indicatorCols.has('created_at') ? 'i.created_at' : 'CURRENT_TIMESTAMP';

            const rows = await sql.unsafe(`
                SELECT
                    EXTRACT(YEAR FROM COALESCE(${lastUpdatedCol}, ${createdAtCol}))::int AS year,
                    ROUND(AVG(CASE WHEN i.target_value > 0 THEN (i.current_value::numeric / i.target_value::numeric) * 100 ELSE 0 END), 2)::float AS avg_performance,
                    ROUND(AVG(CASE WHEN i.total_budget > 0 THEN ((i.total_budget - i.current_budget_balance)::numeric / i.total_budget::numeric) * 100 ELSE 0 END), 2)::float AS avg_budget_used
                FROM indicators i
                WHERE COALESCE(i.status, 'active') != 'archived'
                ${filter}
                GROUP BY year
                ORDER BY year ASC
            `);
            return successResponse(rows);
        }

        if (path.includes('/indicator-velocity')) {
            return successResponse(riskRows.map((row) => ({
                id: row.id,
                title: row.title,
                project_name: row.project_name,
                program_name: row.program_name,
                progress_percentage: row.progress_percentage,
                velocity: row.velocity,
                days_since_update: row.days_since_update,
                estimated_completion_days: row.estimated_completion_days,
                estimated_completion_date: row.estimated_completion_date,
                risk_level: row.risk_level,
                auto_risk_score: row.auto_risk_score,
            })));
        }

        if (path.includes('/risk-summary')) {
            const counts = riskRows.reduce((acc, row) => {
                acc[row.risk_level] = (acc[row.risk_level] || 0) + 1;
                return acc;
            }, { high: 0, medium: 0, low: 0 });

            return successResponse({
                counts,
                high_risk_count: counts.high || 0,
                medium_risk_count: counts.medium || 0,
                low_risk_count: counts.low || 0,
                indicators: riskRows,
                updated_at: new Date().toISOString(),
            });
        }

        return errorResponse('Unsupported analytics route', 404);
    } catch (error) {
        if (error instanceof HttpError) return errorResponse(error.message, error.statusCode);
        console.error('Analytics API error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
