import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams, getPathParam } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
} from './utils/rbac.js';

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

const buildProcurementPolicy = (amount, thresholdValue) => {
    const total = Number(amount || 0);
    if (total >= thresholdValue) {
        return {
            approval_band: 'director_review',
            label: 'Director review',
            control_note: `Director sign-off required because value exceeds ${thresholdValue.toFixed(2)} USD.`,
        };
    }
    if (total >= thresholdValue / 2) {
        return {
            approval_band: 'finance_review',
            label: 'Finance review',
            control_note: 'Finance review required before final release.',
        };
    }
    return {
        approval_band: 'routine_review',
        label: 'Routine review',
        control_note: 'Operational requisition with routine review.',
    };
};

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
                    SELECT
                        a.*,
                        u.name AS requester_name,
                        pr.title AS procurement_title,
                        pr.total_estimated_cost,
                        pr.status AS procurement_status
                    FROM approvals a
                    JOIN users u ON a.requested_by_user_id = u.id
                    LEFT JOIN procurement_requests pr
                        ON a.entity_type = 'procurement'
                       AND pr.id::text = a.entity_id
                    WHERE a.id = ${id}
                `;
                if (approval.length === 0) return errorResponse('Approval not found', 404);

                const logs = await sql`
                    SELECT al.*, u.name AS actor_name
                    FROM approval_logs al
                    JOIN users u ON al.actor_user_id = u.id
                    WHERE al.approval_id = ${id}
                    ORDER BY al.created_at DESC
                `;

                let procurement = null;
                if (approval[0].entity_type === 'procurement') {
                    const thresholdValue = await loadThresholdValue();
                    const requisitions = await sql`
                        SELECT
                            pr.*,
                            p.name AS project_name,
                            bl.code AS budget_line_code,
                            bl.description AS budget_line_name
                        FROM procurement_requests pr
                        LEFT JOIN projects p ON pr.project_id = p.id
                        LEFT JOIN budget_lines bl ON pr.budget_line_id = bl.id
                        WHERE pr.id::text = ${approval[0].entity_id}
                        LIMIT 1
                    `;

                    if (requisitions.length > 0) {
                        const items = await sql`
                            SELECT *
                            FROM procurement_items
                            WHERE request_id = ${requisitions[0].id}
                            ORDER BY created_at ASC
                        `;
                        procurement = {
                            ...requisitions[0],
                            items,
                            policy: buildProcurementPolicy(
                                requisitions[0].total_estimated_cost,
                                thresholdValue
                            ),
                        };
                    }
                }

                return successResponse({ ...approval[0], logs, procurement });
            }

            try {
                const queue = await sql`
                    SELECT
                        a.*,
                        u.name AS requester_name,
                        pr.title AS procurement_title,
                        pr.total_estimated_cost,
                        pr.status AS procurement_status
                    FROM approvals a
                    INNER JOIN users u ON a.requested_by_user_id = u.id
                    LEFT JOIN procurement_requests pr
                        ON a.entity_type = 'procurement'
                       AND (CASE 
                            WHEN a.entity_id IS NOT NULL AND a.entity_id ~ '^[0-9]+$' 
                            THEN pr.id = a.entity_id::integer 
                            ELSE pr.id::text = a.entity_id 
                            END)
                    ORDER BY a.created_at DESC
                `;
                return successResponse(queue);
            } catch (err) {
                console.error('Database error in governance queue:', err);
                throw new HttpError('Failed to fetch governance queue', 500);
            }
        }

        if (method === 'POST') {
            const { approval_id, action, comments } = body;
            if (!approval_id || !action) {
                return errorResponse('Approval ID and action are required', 400);
            }
            if (!['approve', 'reject'].includes(action)) {
                return errorResponse('Action must be approve or reject', 400);
            }

            ensurePermission(actor, 'approval.action');

            const approvals = await sql`
                SELECT *
                FROM approvals
                WHERE id = ${approval_id}
                LIMIT 1
            `;
            if (approvals.length === 0) return errorResponse('Approval not found', 404);

            const approval = approvals[0];

            if (approval.requested_by_user_id === actor.id) {
                return errorResponse('Requester cannot approve or reject their own transaction', 403);
            }
            if (approval.status !== 'pending') {
                return errorResponse('Only pending approvals can be actioned', 400);
            }

            const finalStatus = action === 'approve' ? 'approved' : 'rejected';

            await sql.begin(async (tx) => {
                await tx`
                    UPDATE approvals
                    SET
                        status = ${finalStatus},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${approval_id}
                `;

                await tx`
                    INSERT INTO approval_logs (
                        approval_id,
                        step_number,
                        action,
                        actor_user_id,
                        comments
                    )
                    VALUES (
                        ${approval_id},
                        ${approval.current_step},
                        ${action},
                        ${actor.id},
                        ${comments || null}
                    )
                `;

                if (approval.entity_type === 'procurement') {
                    await tx`
                        UPDATE procurement_requests
                        SET status = ${finalStatus}
                        WHERE id::text = ${approval.entity_id}
                    `;
                }
            });

            return successResponse({ message: `Action ${action} successful`, status: finalStatus });
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
