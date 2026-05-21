import { sql } from './utils/db.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    hasPermission,
} from './utils/rbac.js';
import { successResponse, errorResponse } from './utils/response.js';

const FINANCE_REVIEW_ROLES = [
    'FINANCE_OFFICER',
    'ADMIN_FINANCE_ASSISTANT',
    'FINANCE_ADMIN_OFFICER',
    'ADMIN_ASSISTANT',
    'LOGISTICS_ASSISTANT',
];

const isFinanceReviewer = (roleCode) => FINANCE_REVIEW_ROLES.includes(roleCode);

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
                current_handler_role = 'FINANCE_OFFICER';
            } else if (submission_type === 'request_for_funds') {
                current_handler_role = 'PROGRAMS_ME_OFFICER';
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
                } else if (isFinanceReviewer(userContext.role_code)) {
                    results = await sql`
                        SELECT s.*, u.name as submitter_name
                        FROM unified_submissions s
                        JOIN users u ON s.submitter_user_id = u.id
                        WHERE s.current_handler_role = ANY(${FINANCE_REVIEW_ROLES})
                          AND (${type}::text IS NULL OR s.submission_type = ${type})
                          AND (${status}::text IS NULL OR s.status = ${status})
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
            const currentHandlerMatchesFinance =
                isFinanceReviewer(userContext.role_code) &&
                FINANCE_REVIEW_ROLES.includes(submission.current_handler_role);
            if (submission.current_handler_role !== userContext.role_code &&
                !currentHandlerMatchesFinance &&
                userContext.role_code !== 'DIRECTOR' && 
                userContext.role_code !== 'SYSTEM_ADMIN') {
                throw new HttpError('You are not authorized to act on this submission', 403);
            }

            // Enforce Maker-Checker Security
            if (submission.submitter_user_id === userId && (action === 'approve' || action === 'verify')) {
                throw new HttpError('Maker-Checker Security: You cannot approve or verify your own submission', 403);
            }

            const fromStatus = submission.status;
            let toStatus = fromStatus;
            let currentHandlerRole = submission.current_handler_role;

            if (submission.submission_type === 'request_for_funds') {
                if (action === 'approve' || action === 'verify') {
                    if (submission.current_handler_role === 'PROGRAMS_ME_OFFICER') {
                        toStatus = 'reviewed';
                        currentHandlerRole = 'FINANCE_OFFICER';
                    } else if (submission.current_handler_role === 'FINANCE_OFFICER' || isFinanceReviewer(userContext.role_code)) {
                        // Finance verification with remaining balance check
                        const [rff] = await sql`
                            SELECT * FROM funding_requests WHERE id = ${submission.related_entity_id} LIMIT 1
                        `;
                        if (rff) {
                            const [{ remaining }] = await sql`
                                SELECT COALESCE(SUM(allocated_amount - used_amount), 0) AS remaining
                                FROM budget_lines bl
                                JOIN budgets b ON bl.budget_id = b.id
                                WHERE b.project_id = ${rff.project_id}
                            `;
                            if (Number(rff.total_requested_amount) > Number(remaining)) {
                                throw new HttpError(`Budget Validation Failed: Requested amount ($${Number(rff.total_requested_amount).toFixed(2)}) exceeds remaining project grant balance ($${Number(remaining).toFixed(2)})`, 400);
                            }
                        }
                        toStatus = 'verified';
                        currentHandlerRole = 'DIRECTOR';
                    } else if (submission.current_handler_role === 'DIRECTOR') {
                        toStatus = 'approved';
                        currentHandlerRole = null;
                    }
                } else if (action === 'reject') {
                    toStatus = 'rejected';
                    currentHandlerRole = null;
                } else if (action === 'request_changes') {
                    toStatus = 'pending_changes';
                    currentHandlerRole = null;
                }
            } else {
                if (action === 'approve') {
                    if (next_handler_role) {
                        toStatus = 'reviewed';
                        currentHandlerRole = next_handler_role;
                    } else if (submission.submission_type === 'leave_application' && isFinanceReviewer(userContext.role_code)) {
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

            // Create procurement requests and links if RFF approved
            if (toStatus === 'approved' && submission.submission_type === 'request_for_funds') {
                const [rff] = await sql`
                    SELECT * FROM funding_requests WHERE id = ${submission.related_entity_id} LIMIT 1
                `;
                if (rff) {
                    const procItems = await sql`
                        SELECT * FROM funding_request_items
                        WHERE funding_request_id = ${rff.id}
                          AND category = 'procurement'
                          AND procurement_linked = FALSE
                    `;
                    if (procItems.length > 0) {
                        const totalProcCost = procItems.reduce((sum, item) => sum + Number(item.total_cost), 0);

                        const [procRequest] = await sql`
                            INSERT INTO procurement_requests (
                                requested_by_user_id,
                                project_id,
                                title,
                                justification,
                                total_estimated_cost,
                                status,
                                bid_analysis_status
                            ) VALUES (
                                ${submission.submitter_user_id},
                                ${rff.project_id},
                                ${`Procurement for RFF: ${rff.activity_name}`},
                                ${`Generated from approved Request for Funds: ${rff.narrative_justification}`},
                                ${totalProcCost},
                                'draft',
                                'pending'
                            ) RETURNING id
                        `;

                        for (const item of procItems) {
                            await sql`
                                INSERT INTO procurement_items (
                                    request_id,
                                    description,
                                    quantity,
                                    unit,
                                    estimated_unit_cost
                                ) VALUES (
                                    ${procRequest.id},
                                    ${item.description},
                                    ${item.quantity},
                                    'Unit',
                                    ${item.unit_cost}
                                )
                            `;
                        }

                        await sql`
                            UPDATE funding_request_items
                            SET procurement_linked = TRUE
                            WHERE funding_request_id = ${rff.id}
                              AND category = 'procurement'
                        `;
                    }
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
