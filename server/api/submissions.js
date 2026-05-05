import { sql } from './utils/db.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    hasPermission,
} from './utils/rbac.js';
import { successResponse, errorResponse } from './utils/response.js';

export const handler = async (event) => {
    const method = event.httpMethod;
    const path = event.path;
    const query = event.queryStringParameters || {};

    try {
        const userId = getRequestUserId(event);
        const userContext = await getUserContext(userId);

        // POST /api/submissions - Create a new submission
        if (method === 'POST' && path === '/api/submissions') {
            const body = JSON.parse(event.body || '{}');
            const {
                submission_type,
                department_category,
                title,
                description,
                file_path,
                file_name,
                mime_type,
                related_entity_type,
                related_entity_id,
            } = body;

            if (!submission_type || !title) {
                throw new HttpError('Submission type and title are required', 400);
            }

            // Determine initial handler based on type
            let current_handler_role = 'DIRECTOR';
            if (submission_type === 'leave_application') {
                current_handler_role = 'FINANCE_ADMIN_OFFICER';
            } else if (submission_type === 'request_for_funds') {
                current_handler_role = 'FINANCE_ADMIN_OFFICER';
            }

            const [submission] = await sql`
                INSERT INTO unified_submissions (
                    submitter_user_id,
                    submission_type,
                    department_category,
                    title,
                    description,
                    file_path,
                    file_name,
                    mime_type,
                    current_handler_role,
                    status,
                    related_entity_type,
                    related_entity_id,
                    metadata
                ) VALUES (
                    ${userId},
                    ${submission_type},
                    ${department_category},
                    ${title},
                    ${description},
                    ${file_path},
                    ${file_name},
                    ${mime_type},
                    ${current_handler_role},
                    'submitted',
                    ${related_entity_type},
                    ${related_entity_id},
                    ${body.metadata || {}}
                ) RETURNING *
            `;

            // Initialize leave balance if it's a leave application and balance doesn't exist
            if (submission_type === 'leave_application') {
                await sql`
                    INSERT INTO leave_balances (user_id)
                    VALUES (${userId})
                    ON CONFLICT (user_id) DO NOTHING
                `;
            }

            // Log the initial workflow step
            await sql`
                INSERT INTO submission_workflow_logs (
                    submission_id,
                    action,
                    to_status,
                    acted_by_user_id,
                    comment
                ) VALUES (
                    ${submission.id},
                    'submit',
                    'submitted',
                    ${userId},
                    'Initial submission'
                )
            `;

            return successResponse(submission, 201);
        }

        // GET /api/submissions - List submissions
        if (method === 'GET' && path === '/api/submissions') {
            const limit = parseInt(query.limit) || 50;
            const offset = parseInt(query.offset) || 0;
            const type = query.type;
            const status = query.status;

            let results;
            if (query.view === 'admin' || hasPermission(userContext, 'approval.read')) {
                // Administrative view: see all relevant to role or all if Director
                if (userContext.role_code === 'DIRECTOR' || userContext.role_code === 'SYSTEM_ADMIN') {
                    results = await sql`
                        SELECT s.*, u.name as submitter_name
                        FROM unified_submissions s
                        JOIN users u ON s.submitter_user_id = u.id
                        WHERE (${type}::text IS NULL OR s.submission_type = ${type})
                          AND (${status}::text IS NULL OR s.status = ${status})
                          AND (${query.view}::text != 'admin' OR s.current_handler_role = 'DIRECTOR' OR s.status = 'verified')
                        ORDER BY s.created_at DESC
                        LIMIT ${limit} OFFSET ${offset}
                    `;
                } else {
                    results = await sql`
                        SELECT s.*, u.name as submitter_name
                        FROM unified_submissions s
                        JOIN users u ON s.submitter_user_id = u.id
                        WHERE s.current_handler_role = ${userContext.role_code}
                          AND (${type}::text IS NULL OR s.submission_type = ${type})
                          AND (${status}::text IS NULL OR s.status = ${status})
                        ORDER BY s.created_at DESC
                        LIMIT ${limit} OFFSET ${offset}
                    `;
                }
            } else {
                // Regular user view: only own submissions
                results = await sql`
                    SELECT s.*, u.name as submitter_name
                    FROM unified_submissions s
                    JOIN users u ON s.submitter_user_id = u.id
                    WHERE s.submitter_user_id = ${userId}
                    ORDER BY s.created_at DESC
                    LIMIT ${limit} OFFSET ${offset}
                `;
            }

            return successResponse(results);
        }

        // POST /api/submissions/:id/action - Act on a submission
        const actionMatch = path.match(/\/api\/submissions\/([^\/]+)\/action$/);
        if (method === 'POST' && actionMatch) {
            const submissionId = actionMatch[1];
            const body = JSON.parse(event.body || '{}');
            const { action, comment, next_handler_role } = body;

            if (!action) throw new HttpError('Action is required', 400);

            const [submission] = await sql`
                SELECT * FROM unified_submissions WHERE id = ${submissionId} LIMIT 1
            `;
            if (!submission) throw new HttpError('Submission not found', 404);

            // Permission check: only current handler or Director can act
            if (submission.current_handler_role !== userContext.role_code && 
                userContext.role_code !== 'DIRECTOR' && 
                userContext.role_code !== 'SYSTEM_ADMIN') {
                throw new HttpError('You are not authorized to act on this submission', 403);
            }

            const fromStatus = submission.status;
            let toStatus = fromStatus;
            let currentHandlerRole = submission.current_handler_role;

            if (action === 'approve') {
                if (next_handler_role) {
                    toStatus = 'reviewed';
                    currentHandlerRole = next_handler_role;
                } else if (submission.submission_type === 'leave_application' && userContext.role_code === 'FINANCE_ADMIN_OFFICER') {
                    // Specific workflow for leave: Finance verifies, then Director authorizes
                    toStatus = 'verified';
                    currentHandlerRole = 'DIRECTOR';
                } else {
                    toStatus = 'approved';
                    currentHandlerRole = null;
                }
            } else if (action === 'verify') {
                toStatus = 'verified';
                currentHandlerRole = 'DIRECTOR';
            } else if (action === 'reject') {
                toStatus = 'rejected';
                currentHandlerRole = null;
            } else if (action === 'request_changes') {
                toStatus = 'pending_changes';
                currentHandlerRole = null;
            }

            // Update leave balances if finally approved
            if (toStatus === 'approved' && submission.submission_type === 'leave_application') {
                const daysRequested = Number(submission.metadata?.days_requested || 0);
                if (daysRequested > 0) {
                    await sql`
                        UPDATE leave_balances
                        SET used_days = used_days + ${daysRequested},
                            updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ${submission.submitter_user_id}
                    `;
                }
            }

            // Record signature
            const newSignature = {
                user_id: userId,
                name: userContext.name,
                role: userContext.role_code,
                action: action,
                timestamp: new Date().toISOString(),
                comment: comment
            };

            const [updated] = await sql`
                UPDATE unified_submissions
                SET status = ${toStatus},
                    current_handler_role = ${currentHandlerRole},
                    signatures = signatures || ${JSON.stringify(newSignature)}::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${submissionId}
                RETURNING *
            `;

            // Log the action
            await sql`
                INSERT INTO submission_workflow_logs (
                    submission_id,
                    action,
                    from_status,
                    to_status,
                    acted_by_user_id,
                    comment
                ) VALUES (
                    ${submissionId},
                    ${action},
                    ${fromStatus},
                    ${toStatus},
                    ${userId},
                    ${comment}
                )
            `;

            return successResponse(updated);
        }

        throw new HttpError('Route not found', 404);
    } catch (err) {
        return errorResponse(err);
    }
};
