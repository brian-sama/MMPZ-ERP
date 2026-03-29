import { sql } from './utils/db.js';
import { errorResponse, successResponse } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
} from './utils/rbac.js';

export const handler = async (event) => {
    try {
        const actor = await getUserContext(getRequestUserId(event));
        ensureAnyPermission(
            actor,
            ['approval.read', 'expense.read', 'program.read', 'indicator.read_all', 'indicator.read_assigned'],
            { allowPending: true }
        );

        // ... rest of logic remains correct as it uses the SQL template tags ...
        // (Just ensure the rest of the file uses the correct responses)
        // 1. Fetch KPI basic counts/sums
        const metrics = await sql`
            SELECT 
                (SELECT COUNT(*)::int FROM programs WHERE status = 'active') as active_programs,
                (SELECT COUNT(*)::int FROM projects WHERE status = 'active') as active_projects,
                (SELECT COUNT(*)::int FROM users WHERE role_code = 'DEVELOPMENT_FACILITATOR') as active_facilitators,
                (SELECT COALESCE(SUM(total_budget), 0)::float FROM indicators WHERE status = 'active') as budget_total,
                (SELECT COALESCE(SUM(current_budget_balance), 0)::float FROM indicators WHERE status = 'active') as budget_remaining,
                (SELECT COUNT(*)::int FROM approvals WHERE status = 'pending') as pending_approvals
        `;

        const m = metrics[0];
        const budget_total = m.budget_total || 0;
        const budget_remaining = m.budget_remaining || 0;
        const budget_used = budget_total - budget_remaining;
        const budget_utilization_percent = budget_total > 0
            ? Math.round((budget_used / budget_total) * 100)
            : 0;

        // 2. Fetch key indicators for snapshot
        const keyIndicators = await sql`
            SELECT 
                title, 
                target_value, 
                current_value,
                CASE WHEN target_value > 0 
                    THEN ROUND((current_value::float / target_value::float) * 100) 
                    ELSE 0 
                END as progress_percentage,
                priority,
                status
            FROM indicators
            WHERE status != 'archived'
            ORDER BY priority DESC, created_at DESC
            LIMIT 5
        `;

        // 3. Fetch recent pending approvals preview
        const pendingApprovalsList = await sql`
            SELECT 
                id,
                entity_type AS request_type,
                entity_id,
                created_at,
                (SELECT name FROM users WHERE id = requested_by_user_id) as requester_name
            FROM approvals
            WHERE status = 'pending'
            ORDER BY created_at DESC
            LIMIT 5
        `;

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
