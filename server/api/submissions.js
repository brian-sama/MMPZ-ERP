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

const LEAVE_CATEGORY_OPTIONS = [
    { value: 'vacation_annual', label: 'Vacation/Annual' },
    { value: 'sick', label: 'Sick' },
    { value: 'maternity', label: 'Maternity' },
    { value: 'study', label: 'Study' },
    { value: 'compassionate', label: 'Compassionate' },
    { value: 'off_days', label: 'Off Days' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const roundDays = (value) => Math.round(toNumber(value) * 100) / 100;

const parseDateOnly = (value) => {
    if (!value) return null;
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
};

const calculateLeaveDays = (startDate, endDate, basis = 'calendar') => {
    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (!start || !end || end < start) return 0;

    if (basis === 'business') {
        let count = 0;
        const cursor = new Date(start);
        while (cursor <= end) {
            const day = cursor.getDay();
            if (day !== 0 && day !== 6) count += 1;
            cursor.setDate(cursor.getDate() + 1);
        }
        return count;
    }

    return Math.floor((end - start) / DAY_MS) + 1;
};

const normalizeLeaveType = (value) => {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/\//g, '_')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_');

    if (['annual', 'vacation', 'vacation_annual', 'vacation_and_annual'].includes(normalized)) {
        return 'vacation_annual';
    }
    if (['off', 'offdays', 'off_days'].includes(normalized)) return 'off_days';
    if (normalized === 'compassion') return 'compassionate';
    return LEAVE_CATEGORY_OPTIONS.some((option) => option.value === normalized)
        ? normalized
        : 'vacation_annual';
};

const getLeaveTypeLabel = (value) => {
    const normalized = normalizeLeaveType(value);
    return LEAVE_CATEGORY_OPTIONS.find((option) => option.value === normalized)?.label || 'Vacation/Annual';
};

const roleLabel = (value) =>
    String(value || '')
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');

const getDefaultEmployeeNo = (user) =>
    user?.employee_no ||
    user?.employee_number ||
    user?.staff_number ||
    user?.staff_no ||
    (user?.id ? `MMPZ-${String(user.id).padStart(4, '0')}` : '');

const getLeaveBalanceForMetadata = async (userId) => {
    let [balance] = await sql`
        SELECT allocated_days, used_days, pending_days
        FROM leave_balances
        WHERE user_id = ${userId}
        LIMIT 1
    `;

    if (!balance) {
        [balance] = await sql`
            INSERT INTO leave_balances (user_id)
            VALUES (${userId})
            ON CONFLICT (user_id) DO UPDATE SET updated_at = leave_balances.updated_at
            RETURNING allocated_days, used_days, pending_days
        `;
    }

    const allocated = toNumber(balance?.allocated_days);
    const used = toNumber(balance?.used_days);
    const pending = toNumber(balance?.pending_days);
    return {
        allocated,
        used,
        pending,
        remaining: roundDays(allocated - used - pending),
    };
};

const buildLeaveBreakdown = (metadata, balance) => {
    const selectedType = normalizeLeaveType(metadata.leave_type);
    const daysRequested = roundDays(metadata.days_requested);

    return LEAVE_CATEGORY_OPTIONS.map((option) => {
        const balanceBf = option.value === 'vacation_annual' ? balance.remaining : 0;
        const daysTaken = option.value === selectedType ? daysRequested : 0;
        return {
            leave_type: option.value,
            label: option.label,
            balance_bf: balanceBf,
            days_taken: daysTaken,
            balance_remaining: roundDays(balanceBf - daysTaken),
        };
    });
};

const normalizeLeaveMetadata = async (metadata, userContext) => {
    const source = metadata && typeof metadata === 'object' ? metadata : {};
    const balance = await getLeaveBalanceForMetadata(userContext.id);
    const leaveType = normalizeLeaveType(source.leave_type || source.leave_category);
    const dayCountBasis = source.day_count_basis === 'business' ? 'business' : 'calendar';
    const daysRequested = calculateLeaveDays(source.start_date, source.end_date, dayCountBasis);

    if (!source.start_date || !source.end_date || daysRequested <= 0) {
        throw new HttpError('A valid leave start date and end date are required', 400);
    }

    const normalized = {
        employee_name: String(source.employee_name || userContext.name || '').trim(),
        employee_no: String(source.employee_no || getDefaultEmployeeNo(userContext) || '').trim(),
        position: String(source.position || userContext.job_title || roleLabel(userContext.role_code) || '').trim(),
        contact_address: String(source.contact_address || '').trim(),
        leave_type: leaveType,
        leave_type_label: getLeaveTypeLabel(leaveType),
        start_date: source.start_date,
        end_date: source.end_date,
        day_count_basis: dayCountBasis,
        days_requested: daysRequested,
        leave_balance_snapshot: balance,
        employee_signature: source.employee_signature || {
            name: String(source.employee_name || userContext.name || '').trim(),
            timestamp: new Date().toISOString(),
            method: 'web_form_submission',
        },
    };

    if (!normalized.employee_name || !normalized.employee_no || !normalized.position) {
        throw new HttpError('Employee name, employee number, and position are required', 400);
    }

    if (!normalized.contact_address) {
        throw new HttpError('Contact address during leave period is required', 400);
    }

    normalized.leave_breakdown = buildLeaveBreakdown(normalized, balance);
    return normalized;
};

const buildLeaveSubmissionTitle = (metadata) => {
    const period = metadata.start_date && metadata.end_date
        ? ` (${metadata.start_date} to ${metadata.end_date})`
        : '';
    return `${metadata.employee_name || 'Employee'} - ${metadata.leave_type_label || getLeaveTypeLabel(metadata.leave_type)} Leave${period}`;
};

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
                metadata,
            } = body;

            if (!submission_type) {
                throw new HttpError('Submission type is required', 400);
            }

            let submissionTitle = title;
            let submissionDescription = description;
            let submissionFilePath = file_path;
            let submissionFileName = file_name;
            let submissionMimeType = mime_type;
            let submissionMetadata = metadata || {};

            if (submission_type === 'leave_application') {
                submissionMetadata = await normalizeLeaveMetadata(metadata, userContext);
                submissionTitle = title || buildLeaveSubmissionTitle(submissionMetadata);
                submissionDescription = description || '';
                submissionFilePath = null;
                submissionFileName = null;
                submissionMimeType = null;
            }

            if (!submissionTitle) {
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
                    ${submissionTitle},
                    ${submissionDescription},
                    ${submissionFilePath},
                    ${submissionFileName},
                    ${submissionMimeType},
                    ${current_handler_role},
                    'submitted',
                    ${related_entity_type},
                    ${related_entity_id},
                    ${sql.json(submissionMetadata)}
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
            const type = query.type || null;
            const status = query.status || null;
            const view = query.view || null;

            let results;
            if (view === 'admin' || hasPermission(userContext, 'approval.read')) {
                // Administrative view: see all relevant to role or all if Director
                if (userContext.role_code === 'DIRECTOR' || userContext.role_code === 'SYSTEM_ADMIN') {
                    results = await sql`
                        SELECT s.*, u.name as submitter_name
                        FROM unified_submissions s
                        JOIN users u ON s.submitter_user_id = u.id
                        WHERE (${type}::text IS NULL OR s.submission_type = ${type})
                          AND (${status}::text IS NULL OR s.status = ${status})
                          AND (${view}::text != 'admin' OR s.current_handler_role = 'DIRECTOR' OR s.status = 'verified')
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
        console.error('Submissions function error:', err);
        if (err instanceof HttpError) {
            return errorResponse(err.message, err.statusCode);
        }
        return errorResponse(err.message || 'Internal server error', 500);
    }
};
