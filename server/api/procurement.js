import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams, getPathParam } from './utils/response.js';
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
        const id = getPathParam(event, 'id') || getPathParam(event, 'procurement');
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            let rows;
            if (id) {
                rows = await sql`
                    SELECT pr.*, u.name as requester_name, p.name as project_name, bl.description as budget_line_name
                    FROM procurement_requests pr
                    JOIN users u ON pr.requested_by_user_id = u.id
                    LEFT JOIN projects p ON pr.project_id = p.id
                    LEFT JOIN budget_lines bl ON pr.budget_line_id = bl.id
                    WHERE pr.id = ${id}
                `;
                if (rows.length === 0) return errorResponse('Request not found', 404);

                const items = await sql`SELECT * FROM procurement_items WHERE request_id = ${id}`;
                return successResponse({ ...rows[0], items });
            } else {
                rows = await sql`
                    SELECT pr.*, u.name as requester_name, p.name as project_name
                    FROM procurement_requests pr
                    JOIN users u ON pr.requested_by_user_id = u.id
                    LEFT JOIN projects p ON pr.project_id = p.id
                    ORDER BY pr.created_at DESC
                `;
                return successResponse(rows);
            }
        }

        if (method === 'POST') {
            // anyone can request? usually restricted to certain roles
            ensurePermission(actor, 'expense.create');
            const { project_id, budget_line_id, title, justification, items } = body;

            if (!title || !items || !Array.isArray(items)) return errorResponse('Missing required fields or items', 400);

            const result = await sql.begin(async (tx) => {
                const pr = await tx`
                    INSERT INTO procurement_requests (requested_by_user_id, project_id, budget_line_id, title, justification, status)
                    VALUES (${actor.id}, ${project_id}, ${budget_line_id}, ${title}, ${justification || null}, 'pending_approval')
                    RETURNING id
                `;

                let totalCost = 0;
                for (const item of items) {
                    const cost = (item.quantity || 0) * (item.estimated_unit_cost || 0);
                    totalCost += cost;
                    await tx`
                        INSERT INTO procurement_items (request_id, description, quantity, unit, estimated_unit_cost)
                        VALUES (${pr[0].id}, ${item.description}, ${item.quantity}, ${item.unit}, ${item.estimated_unit_cost})
                    `;
                }

                await tx`UPDATE procurement_requests SET total_estimated_cost = ${totalCost} WHERE id = ${pr[0].id}`;

                // Create Approval Record
                await tx`
                    INSERT INTO approvals (entity_type, entity_id, requested_by_user_id, status)
                    VALUES ('procurement', ${pr[0].id}, ${actor.id}, 'pending')
                `;

                return pr[0];
            });

            return successResponse({ message: 'Procurement request submitted', id: result.id });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Procurement function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
