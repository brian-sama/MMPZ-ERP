import { sql } from './utils/db.js';
import {
    successResponse,
    errorResponse,
    corsResponse,
    getQueryParams,
    parseBody,
} from './utils/response.js';
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
        const actor = await getUserContext(getRequestUserId(event, body));

        // GET - Pending approvals
        if (method === 'GET') {
            ensurePermission(actor, 'approval.read', { allowPending: true });

            const progress = await sql`
                SELECT
                    p.id,
                    p.indicator_id,
                    p.new_value,
                    p.previous_value,
                    p.notes,
                    p.update_date,
                    p.approval_status,
                    'progress_update' AS type,
                    i.title AS indicator_title,
                    u.name AS updated_by_name
                FROM progress_updates p
                LEFT JOIN indicators i ON p.indicator_id = i.id
                LEFT JOIN users u ON p.updated_by_user_id = u.id
                WHERE p.approval_status = 'pending'
                ORDER BY p.update_date DESC
            `;

            const audited = await sql`
                SELECT
                    p.id,
                    p.indicator_id,
                    p.new_value,
                    p.previous_value,
                    p.notes,
                    p.update_date,
                    p.approval_status,
                    p.tally_value,
                    p.tally_status,
                    'progress_update' AS type,
                    i.title AS indicator_title,
                    u.name AS updated_by_name
                FROM progress_updates p
                LEFT JOIN indicators i ON p.indicator_id = i.id
                LEFT JOIN users u ON p.updated_by_user_id = u.id
                WHERE p.approval_status = 'audited'
                ORDER BY p.update_date DESC
            `;

            const kobo = await sql`
                SELECT
                    k.id,
                    k.kobo_form_uid,
                    k.kobo_form_name,
                    k.status,
                    k.requested_by,
                    'kobo_link' AS type,
                    i.title AS indicator_title,
                    u.name AS updated_by_name
                FROM kobo_form_links k
                LEFT JOIN indicators i ON k.indicator_id = i.id
                LEFT JOIN users u ON k.requested_by = u.id
                WHERE k.status = 'pending' OR k.status IS NULL
                ORDER BY k.id DESC
            `;

            const governance = await sql`
                SELECT
                    ar.id,
                    ar.request_type,
                    ar.entity_id,
                    ar.status,
                    ar.notes,
                    ar.created_at,
                    u.name AS requested_by_name
                FROM approval_requests ar
                LEFT JOIN users u ON ar.requested_by_user_id = u.id
                WHERE ar.status = 'pending'
                ORDER BY ar.created_at DESC
            `;

            if (query.countOnly === 'true') {
                return successResponse({
                    total: progress.length + kobo.length + governance.length,
                    actor_role_code: actor.role_code
                });
            }

            return successResponse({ progress, audited, kobo, governance, actor_role_code: actor.role_code, role: actor.role });
        }

        // PATCH - approve/reject
        if (method === 'PATCH') {
            const { id, type, action } = body;
            if (!id || !type || !action) {
                return errorResponse('id, type and action are required', 400);
            }

            if (!['approved', 'rejected'].includes(action)) {
                return errorResponse('Invalid action', 400);
            }

            // Director final authority on approvals
            if (actor.role_code !== 'DIRECTOR') {
                return errorResponse('Only Director can action approvals', 403);
            }
            ensurePermission(actor, 'approval.action');

            if (type === 'progress_update') {
                const updates = await sql`
                    SELECT *
                    FROM progress_updates
                    WHERE id = ${id}
                    LIMIT 1
                `;
                if (updates.length === 0) return errorResponse('Progress update not found', 404);
                const update = updates[0];

                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);

                    await tx`
                        UPDATE progress_updates
                        SET
                            approval_status = ${action},
                            approved_by_user_id = ${actor.id},
                            approval_date = ${new Date().toISOString()}
                        WHERE id = ${id}
                    `;

                    if (action === 'approved') {
                        await tx`
                            UPDATE indicators
                            SET current_value = ${update.new_value}, last_updated = ${new Date().toISOString()}
                            WHERE id = ${update.indicator_id}
                        `;
                    }

                    if (update.updated_by_user_id) {
                        await tx`
                            INSERT INTO notifications (user_id, type, title, message, related_indicator_id)
                            VALUES (
                                ${update.updated_by_user_id},
                                'approval_result',
                                'Progress Update ' || ${action === 'approved' ? 'Approved' : 'Rejected'},
                                ${`Your progress update was ${action}.`},
                                ${update.indicator_id}
                            )
                        `;
                    }
                });

                return successResponse({
                    message: `Progress update ${action}`,
                });
            }

            if (type === 'kobo_link') {
                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`
                        UPDATE kobo_form_links
                        SET status = ${action}
                        WHERE id = ${id}
                    `;
                });
                return successResponse({
                    message: `Kobo link ${action}`,
                });
            }

            if (type === 'governance_request') {
                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`
                        UPDATE approval_requests
                        SET
                            status = ${action},
                            final_decision_by_user_id = ${actor.id},
                            final_decision_at = ${new Date().toISOString()},
                            updated_at = ${new Date().toISOString()}
                        WHERE id = ${id}
                    `;
                });
                return successResponse({ message: `Governance request ${action}` });
            }

            return errorResponse('Invalid approval type', 400);
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Approvals function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
