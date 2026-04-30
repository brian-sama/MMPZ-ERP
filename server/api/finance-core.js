import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    canSeeOrganizationFinance,
} from './utils/rbac.js';

const FINANCE_READ_PERMISSIONS = [
    'expense.read',
    'expense.create',
    'expense.review_finance',
    'approval.read',
];

const THRESHOLD_KEY = 'major_finance_threshold_usd';

const loadThresholdValue = async () => {
    const rows = await sql`
        SELECT value_text
        FROM system_settings
        WHERE setting_key = ${THRESHOLD_KEY}
        LIMIT 1
    `;
    return Number.parseFloat(rows[0]?.value_text || '500');
};

const assertFinanceAccess = (actor) => {
    ensureAnyPermission(actor, FINANCE_READ_PERMISSIONS, { allowPending: true });
};

const projectScopeFilter = (actor, alias = 'p') => {
    if (canSeeOrganizationFinance(actor)) return '';
    const actorId = Number(actor.id);
    return `
        AND (
            ${alias}.owner_user_id = ${actorId}
            OR EXISTS (
                SELECT 1
                FROM project_assignments pa
                WHERE pa.project_id = ${alias}.id
                  AND pa.user_id = ${actorId}
                  AND pa.is_active = TRUE
            )
        )
    `;
};

const procurementScopeFilter = (actor, alias = 'pr') => {
    if (canSeeOrganizationFinance(actor)) return '';
    const actorId = Number(actor.id);
    return `
        AND (
            ${alias}.requested_by_user_id = ${actorId}
            OR EXISTS (
                SELECT 1
                FROM projects scoped_p
                WHERE scoped_p.id = ${alias}.project_id
                  ${projectScopeFilter(actor, 'scoped_p')}
            )
        )
    `;
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method !== 'GET') {
            return errorResponse('Method or Path not allowed', 405);
        }

        assertFinanceAccess(actor);

        if (event.path.includes('/summary')) {
            const thresholdValue = await loadThresholdValue();
            const summary = await sql.unsafe(`
                WITH scoped_budget_lines AS (
                    SELECT bl.*
                    FROM budget_lines bl
                    JOIN budgets b ON b.id = bl.budget_id
                    LEFT JOIN projects p ON p.id = b.project_id
                    WHERE 1=1
                    ${projectScopeFilter(actor, 'p')}
                ),
                scoped_grants AS (
                    SELECT DISTINCT g.*
                    FROM grants g
                    JOIN budgets b ON b.grant_id = g.id
                    LEFT JOIN projects p ON p.id = b.project_id
                    WHERE 1=1
                    ${projectScopeFilter(actor, 'p')}
                ),
                donor_totals AS (
                    SELECT COUNT(DISTINCT d.id)::int AS total_donors
                    FROM donors d
                    ${canSeeOrganizationFinance(actor) ? '' : 'JOIN scoped_grants sg ON sg.donor_id = d.id'}
                ),
                grant_totals AS (
                    SELECT
                        COUNT(*)::int AS total_grants,
                        COALESCE(SUM(total_amount), 0)::numeric AS commitment_total
                    FROM ${canSeeOrganizationFinance(actor) ? 'grants' : 'scoped_grants'}
                ),
                budget_totals AS (
                    SELECT
                        COALESCE(SUM(allocated_amount), 0)::numeric AS allocated_total,
                        COALESCE(SUM(used_amount), 0)::numeric AS spent_total
                    FROM scoped_budget_lines
                ),
                procurement_totals AS (
                    SELECT
                        COALESCE(SUM(CASE WHEN status IN ('approved', 'ordered') THEN total_estimated_cost ELSE 0 END), 0)::numeric AS committed_procurement_total,
                        COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN total_estimated_cost ELSE 0 END), 0)::numeric AS pending_procurement_total,
                        COUNT(*) FILTER (WHERE status IN ('pending_approval', 'approved', 'ordered'))::int AS open_requisitions_count,
                        COUNT(*) FILTER (
                            WHERE status IN ('pending_approval', 'approved', 'ordered')
                              AND created_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
                        )::int AS overdue_requisitions_count
                    FROM procurement_requests pr
                    WHERE 1=1
                    ${procurementScopeFilter(actor, 'pr')}
                )
                SELECT
                    donor_totals.total_donors,
                    grant_totals.total_grants,
                    grant_totals.commitment_total,
                    budget_totals.allocated_total,
                    budget_totals.spent_total,
                    procurement_totals.committed_procurement_total,
                    procurement_totals.pending_procurement_total,
                    procurement_totals.open_requisitions_count,
                    procurement_totals.overdue_requisitions_count
                FROM donor_totals, grant_totals, budget_totals, procurement_totals
            `);

            const metrics = summary[0] || {};
            const availableBalance =
                Number(metrics.allocated_total || 0) -
                Number(metrics.spent_total || 0) -
                Number(metrics.committed_procurement_total || 0);

            const recentProcurement = await sql.unsafe(`
                SELECT
                    pr.id,
                    pr.title,
                    pr.status,
                    pr.total_estimated_cost,
                    pr.created_at,
                    u.name AS requester_name,
                    p.name AS project_name,
                    bl.code AS budget_line_code,
                    CASE
                        WHEN COALESCE(pr.total_estimated_cost, 0) >= ${thresholdValue} THEN 'director_review'
                        WHEN COALESCE(pr.total_estimated_cost, 0) >= ${thresholdValue / 2} THEN 'finance_review'
                        ELSE 'routine_review'
                    END AS approval_band
                FROM procurement_requests pr
                JOIN users u ON pr.requested_by_user_id = u.id
                LEFT JOIN projects p ON pr.project_id = p.id
                LEFT JOIN budget_lines bl ON pr.budget_line_id = bl.id
                WHERE 1=1
                ${procurementScopeFilter(actor, 'pr')}
                ORDER BY pr.created_at DESC
                LIMIT 6
            `);

            return successResponse({
                metrics: {
                    ...metrics,
                    available_balance_total: availableBalance,
                    utilization_rate:
                        Number(metrics.allocated_total || 0) > 0
                            ? Number(metrics.spent_total || 0) / Number(metrics.allocated_total || 0)
                            : 0,
                },
                controls: {
                    major_finance_threshold_usd: thresholdValue,
                    maker_checker_rule: 'Requester, finance reviewer, and final approver must remain distinct actors.',
                    quote_rule:
                        thresholdValue > 0
                            ? `Requests at or above ${thresholdValue.toFixed(2)} USD require documented comparative review and Director sign-off.`
                            : 'Threshold not configured.',
                },
                recent_procurement: recentProcurement,
            });
        }

        if (event.path.includes('/grants')) {
            const rows = await sql.unsafe(`
                SELECT
                    g.*,
                    d.name AS donor_name,
                    COALESCE((
                        SELECT SUM(b.total_amount)
                        FROM budgets b
                        LEFT JOIN projects scoped_budget_p ON scoped_budget_p.id = b.project_id
                        WHERE b.grant_id = g.id
                        ${projectScopeFilter(actor, 'scoped_budget_p')}
                    ), 0)::numeric AS total_budgeted,
                    COALESCE((
                        SELECT SUM(bl.allocated_amount)
                        FROM budget_lines bl
                        JOIN budgets b ON bl.budget_id = b.id
                        LEFT JOIN projects scoped_alloc_p ON scoped_alloc_p.id = b.project_id
                        WHERE b.grant_id = g.id
                        ${projectScopeFilter(actor, 'scoped_alloc_p')}
                    ), 0)::numeric AS total_allocated,
                    COALESCE((
                        SELECT SUM(bl.used_amount)
                        FROM budget_lines bl
                        JOIN budgets b ON bl.budget_id = b.id
                        LEFT JOIN projects scoped_used_p ON scoped_used_p.id = b.project_id
                        WHERE b.grant_id = g.id
                        ${projectScopeFilter(actor, 'scoped_used_p')}
                    ), 0)::numeric AS total_used
                FROM grants g
                JOIN donors d ON g.donor_id = d.id
                ${canSeeOrganizationFinance(actor) ? '' : `
                    WHERE EXISTS (
                        SELECT 1
                        FROM budgets scoped_b
                        LEFT JOIN projects scoped_p ON scoped_p.id = scoped_b.project_id
                        WHERE scoped_b.grant_id = g.id
                        ${projectScopeFilter(actor, 'scoped_p')}
                    )
                `}
                ORDER BY g.created_at DESC
            `);
            return successResponse(rows);
        }

        if (event.path.includes('/budget-lines')) {
            const { project_id } = query;
            const rows = project_id
                ? canSeeOrganizationFinance(actor)
                    ? await sql`
                    WITH procurement_control AS (
                        SELECT
                            budget_line_id,
                            COALESCE(SUM(CASE WHEN status IN ('approved', 'ordered') THEN total_estimated_cost ELSE 0 END), 0)::numeric AS committed_amount,
                            COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN total_estimated_cost ELSE 0 END), 0)::numeric AS pending_amount
                        FROM procurement_requests
                        WHERE budget_line_id IS NOT NULL
                        GROUP BY budget_line_id
                    )
                    SELECT
                        bl.id,
                        bl.budget_id,
                        bl.code,
                        bl.description,
                        bl.allocated_amount,
                        bl.used_amount,
                        COALESCE(pc.committed_amount, 0) AS committed_amount,
                        COALESCE(pc.pending_amount, 0) AS pending_amount,
                        (bl.allocated_amount - bl.used_amount - COALESCE(pc.committed_amount, 0) - COALESCE(pc.pending_amount, 0))::numeric AS available_to_commit,
                        b.name AS budget_name,
                        b.project_id,
                        p.name AS project_name,
                        g.id AS grant_id,
                        g.name AS grant_name
                    FROM budget_lines bl
                    JOIN budgets b ON bl.budget_id = b.id
                    LEFT JOIN projects p ON b.project_id = p.id
                    LEFT JOIN grants g ON b.grant_id = g.id
                    LEFT JOIN procurement_control pc ON pc.budget_line_id = bl.id
                    WHERE b.project_id = ${project_id}
                    ORDER BY g.name NULLS LAST, b.name NULLS LAST, bl.code NULLS LAST, bl.created_at DESC
                `
                    : await sql`
                    WITH procurement_control AS (
                        SELECT
                            budget_line_id,
                            COALESCE(SUM(CASE WHEN status IN ('approved', 'ordered') THEN total_estimated_cost ELSE 0 END), 0)::numeric AS committed_amount,
                            COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN total_estimated_cost ELSE 0 END), 0)::numeric AS pending_amount
                        FROM procurement_requests
                        WHERE budget_line_id IS NOT NULL
                        GROUP BY budget_line_id
                    )
                    SELECT
                        bl.id,
                        bl.budget_id,
                        bl.code,
                        bl.description,
                        bl.allocated_amount,
                        bl.used_amount,
                        COALESCE(pc.committed_amount, 0) AS committed_amount,
                        COALESCE(pc.pending_amount, 0) AS pending_amount,
                        (bl.allocated_amount - bl.used_amount - COALESCE(pc.committed_amount, 0) - COALESCE(pc.pending_amount, 0))::numeric AS available_to_commit,
                        b.name AS budget_name,
                        b.project_id,
                        p.name AS project_name,
                        g.id AS grant_id,
                        g.name AS grant_name
                    FROM budget_lines bl
                    JOIN budgets b ON bl.budget_id = b.id
                    LEFT JOIN projects p ON b.project_id = p.id
                    LEFT JOIN grants g ON b.grant_id = g.id
                    LEFT JOIN procurement_control pc ON pc.budget_line_id = bl.id
                    WHERE b.project_id = ${project_id}
                      AND (
                          p.owner_user_id = ${actor.id}
                          OR EXISTS (
                              SELECT 1
                              FROM project_assignments pa
                              WHERE pa.project_id = p.id
                                AND pa.user_id = ${actor.id}
                                AND pa.is_active = TRUE
                          )
                      )
                    ORDER BY g.name NULLS LAST, b.name NULLS LAST, bl.code NULLS LAST, bl.created_at DESC
                `
                : await sql.unsafe(`
                    WITH procurement_control AS (
                        SELECT
                            budget_line_id,
                            COALESCE(SUM(CASE WHEN status IN ('approved', 'ordered') THEN total_estimated_cost ELSE 0 END), 0)::numeric AS committed_amount,
                            COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN total_estimated_cost ELSE 0 END), 0)::numeric AS pending_amount
                        FROM procurement_requests
                        WHERE budget_line_id IS NOT NULL
                        GROUP BY budget_line_id
                    )
                    SELECT
                        bl.id,
                        bl.budget_id,
                        bl.code,
                        bl.description,
                        bl.allocated_amount,
                        bl.used_amount,
                        COALESCE(pc.committed_amount, 0) AS committed_amount,
                        COALESCE(pc.pending_amount, 0) AS pending_amount,
                        (bl.allocated_amount - bl.used_amount - COALESCE(pc.committed_amount, 0) - COALESCE(pc.pending_amount, 0))::numeric AS available_to_commit,
                        b.name AS budget_name,
                        b.project_id,
                        p.name AS project_name,
                        g.id AS grant_id,
                        g.name AS grant_name
                    FROM budget_lines bl
                    JOIN budgets b ON bl.budget_id = b.id
                    LEFT JOIN projects p ON b.project_id = p.id
                    LEFT JOIN grants g ON b.grant_id = g.id
                    LEFT JOIN procurement_control pc ON pc.budget_line_id = bl.id
                    WHERE 1=1
                    ${projectScopeFilter(actor, 'p')}
                    ORDER BY g.name NULLS LAST, b.name NULLS LAST, bl.code NULLS LAST, bl.created_at DESC
                `);

            return successResponse(rows);
        }

        if (event.path.includes('/budgets')) {
            const { project_id } = query;
            const rows = project_id
                ? canSeeOrganizationFinance(actor)
                    ? await sql`
                    SELECT
                        b.*,
                        g.name AS grant_name,
                        COALESCE(SUM(bl.allocated_amount), 0)::numeric AS total_allocated,
                        COALESCE(SUM(bl.used_amount), 0)::numeric AS total_used
                    FROM budgets b
                    JOIN grants g ON b.grant_id = g.id
                    LEFT JOIN budget_lines bl ON bl.budget_id = b.id
                    WHERE b.project_id = ${project_id}
                    GROUP BY b.id, g.name
                    ORDER BY b.created_at DESC
                `
                    : await sql`
                    SELECT
                        b.*,
                        g.name AS grant_name,
                        COALESCE(SUM(bl.allocated_amount), 0)::numeric AS total_allocated,
                        COALESCE(SUM(bl.used_amount), 0)::numeric AS total_used
                    FROM budgets b
                    JOIN grants g ON b.grant_id = g.id
                    LEFT JOIN budget_lines bl ON bl.budget_id = b.id
                    LEFT JOIN projects p ON p.id = b.project_id
                    WHERE b.project_id = ${project_id}
                      AND (
                          p.owner_user_id = ${actor.id}
                          OR EXISTS (
                              SELECT 1
                              FROM project_assignments pa
                              WHERE pa.project_id = p.id
                                AND pa.user_id = ${actor.id}
                                AND pa.is_active = TRUE
                          )
                      )
                    GROUP BY b.id, g.name
                    ORDER BY b.created_at DESC
                `
                : await sql.unsafe(`
                    SELECT
                        b.*,
                        g.name AS grant_name,
                        COALESCE(SUM(bl.allocated_amount), 0)::numeric AS total_allocated,
                        COALESCE(SUM(bl.used_amount), 0)::numeric AS total_used
                    FROM budgets b
                    JOIN grants g ON b.grant_id = g.id
                    LEFT JOIN budget_lines bl ON bl.budget_id = b.id
                    LEFT JOIN projects p ON p.id = b.project_id
                    WHERE 1=1
                    ${projectScopeFilter(actor, 'p')}
                    GROUP BY b.id, g.name
                    ORDER BY b.created_at DESC
                    LIMIT 50
                `);
            return successResponse(rows);
        }

        return errorResponse('Method or Path not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Finance Core function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
