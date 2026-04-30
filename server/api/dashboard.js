import { sql } from './utils/db.js';
import { errorResponse, successResponse } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    SYSTEM_ROLES,
    canSeeOrganizationDashboard,
} from './utils/rbac.js';

const DASHBOARD_ROLES = new Set([
    'DIRECTOR',
    'COMMUNITY_DEVELOPMENT_OFFICER',
    'PSYCHOSOCIAL_SUPPORT_OFFICER',
    'SOCIAL_SERVICES_INTERN',
    'YOUTH_COMMUNICATIONS_INTERN',
    'ME_INTERN_ACTING_OFFICER',
]);

const getTableColumns = async (tableName) => {
    const rows = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = ${tableName}
    `;
    return new Set(rows.map((row) => row.column_name));
};

const projectScopeFilter = (actor, alias = 'p') => {
    if (canSeeOrganizationDashboard(actor)) return '';
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

const indicatorScopeFilter = (actor, alias = 'i') => {
    if (canSeeOrganizationDashboard(actor)) return '';
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

const approvalScopeFilter = (actor, alias = 'a') => {
    if (canSeeOrganizationDashboard(actor)) return '';
    const actorId = Number(actor.id);
    return `
        AND (
            ${alias}.requested_by_user_id = ${actorId}
            OR EXISTS (
                SELECT 1
                FROM procurement_requests pr
                JOIN projects p ON p.id = pr.project_id
                WHERE ${alias}.entity_type = 'procurement'
                  AND ${alias}.entity_id = pr.id
                  ${projectScopeFilter(actor, 'p')}
            )
        )
    `;
};

export const handler = async (event) => {
    try {
        const actor = await getUserContext(getRequestUserId(event));
        if (!DASHBOARD_ROLES.has(actor.role_code) && actor.system_role !== SYSTEM_ROLES.SUPER_ADMIN) {
            throw new HttpError('Permission denied', 403);
        }

        const userColumns = await getTableColumns('users');
        const indicatorColumns = await getTableColumns('indicators');
        const facilitatorPredicate = userColumns.has('role_code')
            ? `role_code = 'DEVELOPMENT_FACILITATOR'`
            : userColumns.has('role')
                ? `role = 'volunteer'`
                : 'FALSE';
        const totalBudgetExpr = indicatorColumns.has('total_budget')
            ? 'COALESCE(SUM(total_budget), 0)::float'
            : '0::float';
        const budgetRemainingExpr = indicatorColumns.has('current_budget_balance')
            ? 'COALESCE(SUM(current_budget_balance), 0)::float'
            : indicatorColumns.has('total_budget')
                ? 'COALESCE(SUM(total_budget), 0)::float'
                : '0::float';
        const currentValueSource = indicatorColumns.has('current_value') ? 'current_value' : '0';
        const currentValueExpr = `${currentValueSource} AS current_value`;
        const priorityExpr = indicatorColumns.has('priority') ? 'priority' : `'medium' AS priority`;
        const statusExpr = indicatorColumns.has('status') ? 'status' : `'active' AS status`;
        const indicatorStatusFilter = indicatorColumns.has('status')
            ? `WHERE status != 'archived' ${indicatorScopeFilter(actor)}`
            : `WHERE 1=1 ${indicatorScopeFilter(actor)}`;

        // ... rest of logic remains correct as it uses the SQL template tags ...
        // (Just ensure the rest of the file uses the correct responses)
        // 1. Fetch KPI basic counts/sums
        const metrics = await sql.unsafe(`
            SELECT 
                (SELECT COUNT(DISTINCT pg.id)::int
                 FROM programs pg
                 JOIN projects p ON p.program_id = pg.id
                 WHERE pg.status = 'active' ${projectScopeFilter(actor, 'p')}) as active_programs,
                (SELECT COUNT(*)::int FROM projects p WHERE status = 'active' ${projectScopeFilter(actor, 'p')}) as active_projects,
                (SELECT COUNT(*)::int FROM users WHERE ${facilitatorPredicate}) as active_facilitators,
                (SELECT ${totalBudgetExpr} FROM indicators i ${indicatorColumns.has('status') ? "WHERE status = 'active'" : 'WHERE 1=1'} ${indicatorScopeFilter(actor, 'i')}) as budget_total,
                (SELECT ${budgetRemainingExpr} FROM indicators i ${indicatorColumns.has('status') ? "WHERE status = 'active'" : 'WHERE 1=1'} ${indicatorScopeFilter(actor, 'i')}) as budget_remaining,
                (SELECT COUNT(*)::int FROM approvals a WHERE status = 'pending' ${approvalScopeFilter(actor, 'a')}) as pending_approvals
        `);

        const m = metrics[0];
        const budget_total = m.budget_total || 0;
        const budget_remaining = m.budget_remaining || 0;
        const budget_used = budget_total - budget_remaining;
        const budget_utilization_percent = budget_total > 0
            ? Math.round((budget_used / budget_total) * 100)
            : 0;

        // 2. Fetch key indicators for snapshot
        const keyIndicators = await sql.unsafe(`
            SELECT 
                title, 
                target_value, 
                ${currentValueExpr},
                CASE WHEN target_value > 0 
                    THEN ROUND((COALESCE(${currentValueSource}, 0)::float / target_value::float) * 100) 
                    ELSE 0 
                END as progress_percentage,
                ${priorityExpr},
                ${statusExpr}
            FROM indicators
            ${indicatorStatusFilter}
            ORDER BY priority DESC, created_at DESC
            LIMIT 5
        `);

        // 3. Fetch recent pending approvals preview
        const pendingApprovalsList = await sql.unsafe(`
            SELECT 
                id,
                entity_type AS request_type,
                entity_id,
                created_at,
                (SELECT name FROM users WHERE id = requested_by_user_id) as requester_name
            FROM approvals a
            WHERE status = 'pending'
            ${approvalScopeFilter(actor, 'a')}
            ORDER BY created_at DESC
            LIMIT 5
        `);

        return successResponse({
            active_programs: m.active_programs,
            active_projects: m.active_projects,
            active_facilitators: m.active_facilitators,
            budget_total,
            budget_remaining,
            budget_utilization_percent,
            pending_approvals: m.pending_approvals,
            key_indicators: keyIndicators,
            pending_approvals_list: pendingApprovalsList,
            updated_at: new Date().toISOString()
        });

    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Dashboard API Error:', error);
        return errorResponse('Failed to fetch executive dashboard data [DIAG_DASH_001]', 500, {
            message: error.message,
            stack: error.stack,
            requestId: event.requestContext?.requestId
        });
    }
};
