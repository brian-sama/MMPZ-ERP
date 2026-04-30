import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    canSeeOrganizationFinance,
    canSeeOrganizationIndicators,
} from './utils/rbac.js';

const canSeeFullBudget = (actor) =>
    canSeeOrganizationFinance(actor);

const projectScopeFilter = (actor, alias = 'p') => {
    if (canSeeFullBudget(actor) || canSeeOrganizationIndicators(actor)) return '';
    return `
        AND (
            ${alias}.owner_user_id = ${Number(actor.id)}
            OR EXISTS (
                SELECT 1
                FROM project_assignments pa
                WHERE pa.project_id = ${alias}.id
                  AND pa.user_id = ${Number(actor.id)}
                  AND pa.is_active = TRUE
            )
        )
    `;
};

const indicatorScopeFilter = (actor, alias = 'i') => {
    if (canSeeFullBudget(actor) || canSeeOrganizationIndicators(actor)) return '';
    return `
        AND (
            ${alias}.created_by_user_id = ${Number(actor.id)}
            OR EXISTS (
                SELECT 1
                FROM project_assignments pa
                WHERE pa.project_id = ${alias}.project_id
                  AND pa.user_id = ${Number(actor.id)}
                  AND pa.is_active = TRUE
            )
        )
    `;
};

const utilization = (spent, allocated) => {
    const numericAllocated = Number(allocated || 0);
    if (numericAllocated <= 0) return 0;
    return Math.round((Number(spent || 0) / numericAllocated) * 100);
};

const normalizeBudgetRow = (row) => ({
    ...row,
    allocated: Number(row.allocated || 0),
    spent: Number(row.spent || 0),
    committed: Number(row.committed || 0),
    pending: Number(row.pending || 0),
    remaining: Number(row.remaining || 0),
    utilization_percent: utilization(row.spent, row.allocated),
});

const loadProgramBudgets = async (actor) => {
    const rows = await sql.unsafe(`
        WITH indicator_rollup AS (
            SELECT
                p.program_id,
                COALESCE(SUM(i.total_budget), 0)::float AS indicator_allocated,
                COALESCE(SUM(GREATEST(i.total_budget - i.current_budget_balance, 0)), 0)::float AS indicator_spent
            FROM indicators i
            LEFT JOIN projects p ON p.id = i.project_id
            WHERE p.program_id IS NOT NULL
            ${indicatorScopeFilter(actor, 'i')}
            GROUP BY p.program_id
        ),
        finance_rollup AS (
            SELECT
                p.program_id,
                COALESCE(SUM(bl.allocated_amount), 0)::float AS allocated,
                COALESCE(SUM(bl.used_amount), 0)::float AS spent
            FROM budget_lines bl
            JOIN budgets b ON b.id = bl.budget_id
            LEFT JOIN projects p ON p.id = b.project_id
            WHERE p.program_id IS NOT NULL
            ${projectScopeFilter(actor, 'p')}
            GROUP BY p.program_id
        ),
        procurement_rollup AS (
            SELECT
                p.program_id,
                COALESCE(SUM(CASE WHEN pr.status IN ('approved', 'ordered') THEN pr.total_estimated_cost ELSE 0 END), 0)::float AS committed,
                COALESCE(SUM(CASE WHEN pr.status = 'pending_approval' THEN pr.total_estimated_cost ELSE 0 END), 0)::float AS pending
            FROM procurement_requests pr
            LEFT JOIN projects p ON p.id = pr.project_id
            WHERE p.program_id IS NOT NULL
            ${projectScopeFilter(actor, 'p')}
            GROUP BY p.program_id
        )
        SELECT
            pg.id,
            pg.name,
            pg.status,
            COALESCE(fr.allocated, ir.indicator_allocated, 0)::float AS allocated,
            COALESCE(fr.spent, ir.indicator_spent, 0)::float AS spent,
            COALESCE(proc.committed, 0)::float AS committed,
            COALESCE(proc.pending, 0)::float AS pending,
            GREATEST(COALESCE(fr.allocated, ir.indicator_allocated, 0) - COALESCE(fr.spent, ir.indicator_spent, 0) - COALESCE(proc.committed, 0), 0)::float AS remaining,
            COUNT(DISTINCT p.id)::int AS project_count
        FROM programs pg
        LEFT JOIN projects p ON p.program_id = pg.id
        LEFT JOIN indicator_rollup ir ON ir.program_id = pg.id
        LEFT JOIN finance_rollup fr ON fr.program_id = pg.id
        LEFT JOIN procurement_rollup proc ON proc.program_id = pg.id
        WHERE 1=1
        ${canSeeFullBudget(actor) || canSeeOrganizationIndicators(actor) ? '' : `
            AND EXISTS (
                SELECT 1
                FROM projects scoped_p
                WHERE scoped_p.program_id = pg.id
                ${projectScopeFilter(actor, 'scoped_p')}
            )
        `}
        GROUP BY pg.id, pg.name, pg.status, fr.allocated, fr.spent, ir.indicator_allocated, ir.indicator_spent, proc.committed, proc.pending
        ORDER BY pg.name ASC
    `);
    return rows.map(normalizeBudgetRow);
};

const loadIndicatorBudgets = async (actor) => {
    const rows = await sql.unsafe(`
        WITH procurement_rollup AS (
            SELECT
                pr.project_id,
                COALESCE(SUM(CASE WHEN pr.status IN ('approved', 'ordered') THEN pr.total_estimated_cost ELSE 0 END), 0)::float AS committed,
                COALESCE(SUM(CASE WHEN pr.status = 'pending_approval' THEN pr.total_estimated_cost ELSE 0 END), 0)::float AS pending
            FROM procurement_requests pr
            GROUP BY pr.project_id
        ),
        activity_rollup AS (
            SELECT indicator_id, COALESCE(SUM(cost), 0)::float AS activity_spent
            FROM activities
            GROUP BY indicator_id
        )
        SELECT
            i.id,
            i.title AS name,
            i.status,
            i.priority,
            p.name AS project_name,
            pg.name AS program_name,
            i.total_budget::float AS allocated,
            COALESCE(ar.activity_spent, GREATEST(i.total_budget - i.current_budget_balance, 0))::float AS spent,
            COALESCE(proc.committed, 0)::float AS committed,
            COALESCE(proc.pending, 0)::float AS pending,
            GREATEST(i.current_budget_balance, 0)::float AS remaining,
            CASE WHEN i.target_value > 0 THEN ROUND((i.current_value::float / i.target_value::float) * 100) ELSE 0 END AS progress_percentage
        FROM indicators i
        LEFT JOIN projects p ON p.id = i.project_id
        LEFT JOIN programs pg ON pg.id = p.program_id
        LEFT JOIN procurement_rollup proc ON proc.project_id = i.project_id
        LEFT JOIN activity_rollup ar ON ar.indicator_id = i.id
        WHERE COALESCE(i.status, 'active') != 'archived'
        ${indicatorScopeFilter(actor, 'i')}
        ORDER BY i.priority DESC, i.created_at DESC
    `);
    return rows.map(normalizeBudgetRow);
};

const loadActivityBudgets = async (actor) => {
    const rows = await sql.unsafe(`
        SELECT
            a.id,
            a.description AS name,
            a.category,
            a.activity_date,
            a.cost::float AS spent,
            0::float AS allocated,
            0::float AS committed,
            0::float AS pending,
            0::float AS remaining,
            i.title AS indicator_name,
            p.name AS project_name,
            pg.name AS program_name
        FROM activities a
        LEFT JOIN indicators i ON i.id = a.indicator_id
        LEFT JOIN projects p ON p.id = COALESCE(a.project_id, i.project_id)
        LEFT JOIN programs pg ON pg.id = p.program_id
        WHERE 1=1
        ${indicatorScopeFilter(actor, 'i')}
        ORDER BY a.activity_date DESC, a.id DESC
    `);
    return rows.map(normalizeBudgetRow);
};

const buildOverview = (programs, indicators, activities) => {
    const totals = indicators.reduce((acc, row) => {
        acc.allocated += Number(row.allocated || 0);
        acc.spent += Number(row.spent || 0);
        acc.committed += Number(row.committed || 0);
        acc.pending += Number(row.pending || 0);
        acc.remaining += Number(row.remaining || 0);
        return acc;
    }, { allocated: 0, spent: 0, committed: 0, pending: 0, remaining: 0 });

    return {
        ...totals,
        utilization_percent: utilization(totals.spent, totals.allocated),
        program_count: programs.length,
        indicator_count: indicators.length,
        activity_count: activities.length,
        recent_activities: activities.slice(0, 8),
        pressure_indicators: indicators
            .filter((row) => row.allocated > 0 && row.remaining / row.allocated < 0.2)
            .slice(0, 8),
    };
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();
    if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

    try {
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event) || query.userId);
        ensureAnyPermission(actor, ['indicator.read_all', 'indicator.read_assigned', 'project.read', 'activity.read', 'expense.read'], {
            allowPending: true,
        });

        const [programs, indicators, activities] = await Promise.all([
            loadProgramBudgets(actor),
            loadIndicatorBudgets(actor),
            loadActivityBudgets(actor),
        ]);

        const path = event.path || '';
        if (path.includes('/programs')) return successResponse(programs);
        if (path.includes('/indicators')) return successResponse(indicators);
        if (path.includes('/activities')) return successResponse(activities);
        if (path.includes('/overview')) return successResponse(buildOverview(programs, indicators, activities));

        return errorResponse('Unsupported budget route', 404);
    } catch (error) {
        if (error instanceof HttpError) return errorResponse(error.message, error.statusCode);
        console.error('Budget API error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
