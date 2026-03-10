import { sql } from './utils/db.js';
import {
    successResponse,
    errorResponse,
    corsResponse,
    parseBody,
    getPathParam,
} from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    ensureAnyPermission,
    hasPermission,
    setAuditActor,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const indicatorId = getPathParam(event, 'indicators');
        if (!indicatorId) return errorResponse('Indicator ID is required', 400);

        const body = parseBody(event);
        const actor = await getUserContext(getRequestUserId(event, body));

        // GET - progress history
        if (method === 'GET') {
            ensureAnyPermission(actor, ['indicator.read_all', 'indicator.read_assigned'], {
                allowPending: true,
            });

            const indicatorRows = await sql`
                SELECT id, created_by_user_id, project_id
                FROM indicators
                WHERE id = ${indicatorId}
                LIMIT 1
            `;
            if (indicatorRows.length === 0) return errorResponse('Indicator not found', 404);

            const indicator = indicatorRows[0];
            if (
                !hasPermission(actor, 'indicator.read_all') &&
                indicator.created_by_user_id !== actor.id
            ) {
                const assignment = await sql`
                    SELECT id
                    FROM project_assignments
                    WHERE project_id = ${indicator.project_id}
                      AND user_id = ${actor.id}
                      AND is_active = TRUE
                    LIMIT 1
                `;
                if (assignment.length === 0) return errorResponse('Permission denied', 403);
            }

            const data = await sql`
                SELECT
                    p.*,
                    u1.name AS updated_by_name,
                    u2.name AS approved_by_name
                FROM progress_updates p
                LEFT JOIN users u1 ON p.updated_by_user_id = u1.id
                LEFT JOIN users u2 ON p.approved_by_user_id = u2.id
                WHERE p.indicator_id = ${indicatorId}
                ORDER BY p.update_date DESC
            `;
            return successResponse(data);
        }

        // POST - create progress update
        if (method === 'POST') {
            ensurePermission(actor, 'progress.create');

            const notes = body.notes || null;
            const newValueRaw = body.new_value !== undefined ? body.new_value : body.newValue;
            const previousValueRaw =
                body.previous_value !== undefined ? body.previous_value : body.previousValue;
            const newValue = Number.parseInt(newValueRaw, 10);
            const previousValue = Number.parseInt(previousValueRaw || 0, 10);

            if (Number.isNaN(newValue) || newValue < 0) {
                return errorResponse('New value must be a valid positive number', 400);
            }

            const indicatorRows = await sql`
                SELECT id
                FROM indicators
                WHERE id = ${indicatorId}
                LIMIT 1
            `;
            if (indicatorRows.length === 0) return errorResponse('Indicator not found', 404);

            const canAutoApprove = actor.role_code === 'DIRECTOR' || hasPermission(actor, 'progress.approve');

            let approvalStatus = canAutoApprove ? 'approved' : 'pending';
            if (!canAutoApprove) {
                const koboLinks = await sql`
                    SELECT id
                    FROM kobo_form_links
                    WHERE indicator_id = ${indicatorId}
                      AND sync_enabled = TRUE
                `;
                if (koboLinks.length > 0) approvalStatus = 'awaiting_audit';
            }

            const inserted = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                const rows = await tx`
                    INSERT INTO progress_updates (
                        indicator_id,
                        updated_by_user_id,
                        previous_value,
                        new_value,
                        notes,
                        approval_status,
                        approved_by_user_id,
                        approval_date
                    )
                    VALUES (
                        ${indicatorId},
                        ${actor.id},
                        ${Number.isNaN(previousValue) ? 0 : previousValue},
                        ${newValue},
                        ${notes},
                        ${approvalStatus},
                        ${canAutoApprove ? actor.id : null},
                        ${canAutoApprove ? new Date().toISOString() : null}
                    )
                    RETURNING *
                `;

                if (canAutoApprove) {
                    await tx`
                        UPDATE indicators
                        SET current_value = ${newValue}, last_updated = ${new Date().toISOString()}
                        WHERE id = ${indicatorId}
                    `;
                } else {
                    const directors = await tx`
                        SELECT id
                        FROM users
                        WHERE role_code = 'DIRECTOR'
                    `;
                    const message =
                        approvalStatus === 'awaiting_audit'
                            ? 'A new progress update is awaiting Kobo audit.'
                            : 'A new progress update needs approval.';

                    for (const director of directors) {
                        await tx`
                            INSERT INTO notifications (user_id, type, title, message, related_indicator_id)
                            VALUES (
                                ${director.id},
                                'approval_needed',
                                'Progress Approval Needed',
                                ${message},
                                ${indicatorId}
                            )
                        `;
                    }
                }

                return rows[0];
            });

            return successResponse({
                message: 'Progress update submitted successfully',
                update: inserted,
            });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Progress function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
