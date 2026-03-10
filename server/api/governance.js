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
        const id = getPathParam(event, 'id') || getPathParam(event, 'governance');
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            ensurePermission(actor, 'approval.read', { allowPending: true });

            if (id) {
                const approval = await sql`
                    SELECT a.*, u.name as requester_name 
                    FROM approvals a
                    JOIN users u ON a.requested_by_user_id = u.id
                    WHERE a.id = ${id}
                `;
                if (approval.length === 0) return errorResponse('Approval not found', 404);

                const logs = await sql`
                    SELECT al.*, u.name as actor_name 
                    FROM approval_logs al
                    JOIN users u ON al.actor_user_id = u.id
                    WHERE al.approval_id = ${id}
                    ORDER BY al.created_at DESC
                `;

                return successResponse({ ...approval[0], logs });
            }

            const queue = await sql`
                SELECT a.*, u.name as requester_name 
                FROM approvals a
                JOIN users u ON a.requested_by_user_id = u.id
                ORDER BY a.created_at DESC
            `;
            return successResponse(queue);
        }

        if (method === 'POST') {
            // Action an approval
            const { approval_id, action, comments } = body;
            if (!approval_id || !action) return errorResponse('Approval ID and Action are required', 400);

            ensurePermission(actor, 'approval.action');

            const result = await sql.begin(async (tx) => {
                const approval = await tx`SELECT * FROM approvals WHERE id = ${approval_id} FOR UPDATE`;
                if (approval.length === 0) return errorResponse('Approval not found', 404);

                // Update approval status
                await tx`
                    UPDATE approvals 
                    SET status = ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending'},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${approval_id}
                `;

                // Log the action
                await tx`
                    INSERT INTO approval_logs (approval_id, step_number, action, actor_user_id, comments)
                    VALUES (${approval_id}, ${approval[0].current_step}, ${action}, ${actor.id}, ${comments})
                `;

                // Handle entity specific side effects (e.g. update procurement status)
                if (approval[0].entity_type === 'procurement') {
                    await tx`
                        UPDATE procurement_requests 
                        SET status = ${action === 'approve' ? 'approved' : 'rejected'} 
                        WHERE id = ${approval[0].entity_id}::uuid
                    `;
                }

                return { status: action };
            });

            return successResponse({ message: `Action ${action} successful`, result });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Governance function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
