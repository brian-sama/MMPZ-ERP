import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams, getPathParam } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    setAuditActor,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const id = getPathParam(event, 'id') || getPathParam(event, 'approvals');
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            ensurePermission(actor, 'approval.read', { allowPending: true });

            const requests = await sql`
                SELECT
                    ar.*,
                    u.name AS requested_by_name,
                    d.name AS final_decision_by_name
                FROM approval_requests ar
                LEFT JOIN users u ON ar.requested_by_user_id = u.id
                LEFT JOIN users d ON ar.final_decision_by_user_id = d.id
                ORDER BY ar.created_at DESC
            `;

            const requestIds = requests.map((r) => r.id);
            let stepsByRequest = {};
            if (requestIds.length > 0) {
                const steps = await sql`
                    SELECT *
                    FROM approval_steps
                    WHERE approval_request_id = ANY(${requestIds})
                    ORDER BY approval_request_id ASC, step_order ASC
                `;

                stepsByRequest = steps.reduce((acc, step) => {
                    if (!acc[step.approval_request_id]) acc[step.approval_request_id] = [];
                    acc[step.approval_request_id].push(step);
                    return acc;
                }, {});
            }

            const payload = requests.map((request) => ({
                ...request,
                steps: stepsByRequest[request.id] || [],
            }));

            return successResponse(payload);
        }

        if (method === 'PATCH') {
            ensurePermission(actor, 'approval.action');
            if (actor.role_code !== 'DIRECTOR') {
                return errorResponse('Only Director can action governance approvals', 403);
            }

            const approvalId = id || body.id;
            if (!approvalId) return errorResponse('Approval request ID is required', 400);

            const action = body.action;
            if (!['approved', 'rejected', 'cancelled'].includes(action)) {
                return errorResponse('Invalid action', 400);
            }

            const rows = await sql`
                SELECT *
                FROM approval_requests
                WHERE id = ${approvalId}
                LIMIT 1
            `;
            if (rows.length === 0) return errorResponse('Approval request not found', 404);

            const request = rows[0];

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);

                await tx`
                    UPDATE approval_requests
                    SET
                        status = ${action},
                        final_decision_by_user_id = ${actor.id},
                        final_decision_at = ${new Date().toISOString()},
                        notes = COALESCE(${body.notes || null}, notes),
                        updated_at = ${new Date().toISOString()}
                    WHERE id = ${approvalId}
                `;

                await tx`
                    UPDATE approval_steps
                    SET
                        action = ${action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : 'skipped'},
                        approver_user_id = ${actor.id},
                        acted_at = ${new Date().toISOString()},
                        comments = ${body.notes || null}
                    WHERE approval_request_id = ${approvalId}
                      AND action = 'pending'
                `;

                const expenseEntityId = String(request.entity_id || '');
                if (request.request_type === 'expense' && /^[0-9]+$/.test(expenseEntityId)) {
                    const expenseId = Number.parseInt(request.entity_id, 10);
                    if (action === 'approved') {
                        await tx`
                            UPDATE expense_requests
                            SET
                                status = 'approved',
                                approved_by_user_id = ${actor.id},
                                director_decision_at = ${new Date().toISOString()},
                                updated_at = ${new Date().toISOString()}
                            WHERE id = ${expenseId}
                        `;
                    }
                    if (action === 'rejected') {
                        await tx`
                            UPDATE expense_requests
                            SET
                                status = 'rejected',
                                approved_by_user_id = ${actor.id},
                                director_decision_at = ${new Date().toISOString()},
                                rejection_reason = ${body.notes || 'Rejected by Director'},
                                updated_at = ${new Date().toISOString()}
                            WHERE id = ${expenseId}
                        `;
                    }
                }
            });

            return successResponse({ message: `Governance approval ${action}` });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Governance approvals error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
