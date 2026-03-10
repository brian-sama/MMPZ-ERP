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

        // GET /api/finance/summary
        if (method === 'GET' && event.path.includes('/summary')) {
            const summary = await sql`
                SELECT 
                    (SELECT COUNT(*) FROM donors) as total_donors,
                    (SELECT COUNT(*) FROM grants) as total_grants,
                    (SELECT COALESCE(SUM(total_amount), 0) FROM grants) as commitment_total,
                    (SELECT COALESCE(SUM(allocated_amount), 0) FROM budget_lines) as allocated_total,
                    (SELECT COALESCE(SUM(used_amount), 0) FROM budget_lines) as spent_total
            `;

            const recentGrants = await sql`
                SELECT g.*, d.name as donor_name
                FROM grants g
                JOIN donors d ON g.donor_id = d.id
                ORDER BY g.created_at DESC
                LIMIT 5
            `;

            return successResponse({
                metrics: summary[0],
                recent_grants: recentGrants
            });
        }

        // GET /api/finance/grants
        if (method === 'GET' && event.path.includes('/grants')) {
            const rows = await sql`
                SELECT g.*, d.name as donor_name,
                (SELECT COALESCE(SUM(total_amount), 0) FROM budgets WHERE grant_id = g.id) as total_budgeted
                FROM grants g
                JOIN donors d ON g.donor_id = d.id
                ORDER BY g.created_at DESC
            `;
            return successResponse(rows);
        }

        // GET /api/finance/budgets (by project)
        if (method === 'GET' && event.path.includes('/budgets')) {
            const { project_id } = query;
            let rows;
            if (project_id) {
                rows = await sql`
                    SELECT b.*, g.name as grant_name,
                    (SELECT COALESCE(SUM(allocated_amount), 0) FROM budget_lines WHERE budget_id = b.id) as total_allocated,
                    (SELECT COALESCE(SUM(used_amount), 0) FROM budget_lines WHERE budget_id = b.id) as total_used
                    FROM budgets b
                    JOIN grants g ON b.grant_id = g.id
                    WHERE b.project_id = ${project_id}
                `;
            } else {
                rows = await sql`SELECT * FROM budgets ORDER BY created_at DESC LIMIT 50`;
            }
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
