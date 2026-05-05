import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams, getPathParam } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
} from './utils/rbac.js';
import { createNotification } from './utils/notification-center.js';

const THRESHOLD_KEY = 'major_finance_threshold_usd';

const getProcurementRequestColumns = async () => {
    const rows = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'procurement_requests'
    `;
    return new Set(rows.map((row) => row.column_name));
};

const hasBidAnalysisColumns = (columns) =>
    [
        'bid_analysis_summary',
        'bid_analysis_recommendation',
        'bid_analysis_status',
        'bid_analysis_reviewed_by_user_id',
        'bid_analysis_approved_by_user_id',
        'bid_analysis_reviewed_at',
        'bid_analysis_approved_at',
    ].every((column) => columns.has(column));

const loadThresholdValue = async () => {
    const rows = await sql`
        SELECT value_text
        FROM system_settings
        WHERE setting_key = ${THRESHOLD_KEY}
        LIMIT 1
    `;
    return Number.parseFloat(rows[0]?.value_text || '500');
};

const loadPendingCount = async () => {
    const tableCheck = await sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'approvals'
        ) AS exists
    `;
    if (!tableCheck[0]?.exists) return 0;

    const rows = await sql`
        SELECT COUNT(*)::int AS total
        FROM approvals
        WHERE status = 'pending'
    `;
    return rows[0]?.total || 0;
};

const FINANCE_TEAM_ROLES = ['FINANCE_ADMIN_OFFICER', 'ADMIN_ASSISTANT', 'LOGISTICS_ASSISTANT'];

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
            if (query.countOnly === 'true') {
                try {
                    return successResponse({
                        total: await loadPendingCount(),
                    });
                } catch (err) {
                    console.error('Database error in governance queue count:', err);
                    throw new HttpError('Failed to fetch governance queue count', 500);
                }
            }

            const procurementColumns = await getProcurementRequestColumns();
            const bidAnalysisEnabled = hasBidAnalysisColumns(procurementColumns);

            if (id) {
                const approval = await sql`
                    SELECT
                        a.*,
                        u.name AS requester_name,
                        pr.title AS procurement_title,
                        pr.total_estimated_cost,
                        pr.status AS procurement_status,
                        ${bidAnalysisEnabled ? sql`pr.bid_analysis_summary, pr.bid_analysis_recommendation, pr.bid_analysis_status` : sql`NULL::text AS bid_analysis_summary, NULL::text AS bid_analysis_recommendation, 'pending'::text AS bid_analysis_status`},
                        vs.type AS submission_type,
                        vs.title AS submission_title,
                        vs.file_name AS submission_file_name,
                        vs.file_path AS submission_file_path,
                        vs.description AS submission_description,
                        vs.content AS submission_content,
                        p.name AS project_name
                    FROM approvals a
                    JOIN users u ON a.requested_by_user_id = u.id
                    LEFT JOIN procurement_requests pr
                        ON a.entity_type = 'procurement'
                       AND pr.id::text = a.entity_id
                    LEFT JOIN volunteer_submissions vs
                        ON a.entity_type = 'volunteer_submission'
                       AND vs.id::text = a.entity_id
                    LEFT JOIN unified_submissions us
                        ON a.entity_type = 'unified_submission'
                       AND us.id::text = a.entity_id
                    LEFT JOIN projects p ON vs.project_id = p.id
                    WHERE a.id = ${id}
                `;
                let currentApproval = approval[0];
                
                if (!currentApproval) {
                    // Try to fetch from unified_submissions directly if not in approvals table
                    const unified = await sql`
                        SELECT 
                            s.id::text as id, 'unified_submission' as entity_type, s.id::text as entity_id, s.status, 
                            u.name as requester_name, u.role_code as requester_role, s.created_at,
                            s.title as submission_title, s.description as submission_description,
                            s.file_name as submission_file_name, s.file_path as submission_file_path,
                            s.submission_type, s.metadata, s.signatures
                        FROM unified_submissions s
                        JOIN users u ON s.submitter_user_id = u.id
                        WHERE s.id::text = ${id}
                        LIMIT 1
                    `;
                    if (unified.length > 0) {
                        currentApproval = {
                            ...unified[0],
                            display_type: unified[0].submission_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                            entity_data: {
                                title: unified[0].submission_title,
                                description: unified[0].submission_description,
                                type: unified[0].submission_type,
                                ...unified[0].metadata
                            }
                        };
                        return successResponse(currentApproval);
                    }
                    return errorResponse('Approval not found', 404);
                }

                const logs = await sql`
                    SELECT al.*, u.name AS actor_name
                    FROM approval_logs al
                    JOIN users u ON al.actor_user_id = u.id
                    WHERE al.approval_id = ${id}
                    ORDER BY al.created_at DESC
                `;

                let procurement = null;
                let submission = null;

                if (approval[0].entity_type === 'procurement') {
                    const thresholdValue = await loadThresholdValue();
                    const requisitions = bidAnalysisEnabled ? await sql`
                        SELECT
                            pr.*,
                            p.name AS project_name,
                            bl.code AS budget_line_code,
                            bl.description AS budget_line_name,
                            reviewer.name AS bid_analysis_reviewer_name,
                            approver.name AS bid_analysis_approver_name
                        FROM procurement_requests pr
                        LEFT JOIN projects p ON pr.project_id = p.id
                        LEFT JOIN budget_lines bl ON pr.budget_line_id = bl.id
                        LEFT JOIN users reviewer ON reviewer.id = pr.bid_analysis_reviewed_by_user_id
                        LEFT JOIN users approver ON approver.id = pr.bid_analysis_approved_by_user_id
                        WHERE pr.id::text = ${approval[0].entity_id}
                        LIMIT 1
                    ` : await sql`
                        SELECT
                            pr.*,
                            NULL::text AS bid_analysis_summary,
                            NULL::text AS bid_analysis_recommendation,
                            'pending'::text AS bid_analysis_status,
                            NULL::text AS bid_analysis_reviewer_name,
                            NULL::text AS bid_analysis_approver_name,
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
                } else if (approval[0].entity_type === 'volunteer_submission') {
                    submission = {
                        type: approval[0].submission_type,
                        title: approval[0].submission_title,
                        fileName: approval[0].submission_file_name,
                        filePath: approval[0].submission_file_path,
                        description: approval[0].submission_description,
                        content: approval[0].submission_content,
                        projectName: approval[0].project_name
                    };
                }

                // Add display_type helper
                const formatDisplayType = (entityType, subType) => {
                    if (entityType === 'procurement') return 'Procurement Requisition';
                    if (entityType === 'volunteer_submission') {
                        if (!subType) return 'Document Submission';
                        return subType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    }
                    return entityType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                };

                return successResponse({ 
                    ...approval[0], 
                    logs, 
                    procurement, 
                    submission,
                    display_type: formatDisplayType(approval[0].entity_type, approval[0].submission_type)
                });
            }

            try {
                const results = await sql`
                    (
                        SELECT
                            a.id, a.entity_type, a.entity_id, a.status, a.current_step, a.created_at,
                            u.name AS requester_name,
                            'DIRECTOR' as requester_role, -- Simplified for union
                            pr.title AS procurement_title,
                            vs.type AS submission_type
                        FROM approvals a
                        INNER JOIN users u ON a.requested_by_user_id = u.id
                        LEFT JOIN procurement_requests pr
                            ON a.entity_type = 'procurement'
                           AND pr.id::text = a.entity_id
                        LEFT JOIN volunteer_submissions vs
                            ON a.entity_type = 'volunteer_submission'
                           AND vs.id::text = a.entity_id
                        WHERE a.status = 'pending'
                    )
                    UNION ALL
                    (
                        SELECT
                            s.id::text as id, 'unified_submission' as entity_type, s.id::text as entity_id, s.status, 1 as current_step, s.created_at,
                            u.name AS requester_name,
                            u.role_code as requester_role,
                            s.title as procurement_title,
                            s.submission_type as submission_type
                        FROM unified_submissions s
                        JOIN users u ON s.submitter_user_id = u.id
                        WHERE s.status IN ('submitted', 'verified')
                          AND (
                            (${actor.role_code} = 'DIRECTOR' AND (s.current_handler_role = 'DIRECTOR' OR s.status = 'verified'))
                            OR (${actor.role_code} = 'FINANCE_ADMIN_OFFICER' AND s.current_handler_role = 'FINANCE_ADMIN_OFFICER')
                          )
                    )
                    ORDER BY created_at DESC
                `;

                const queue = results.map(item => {
                    let display_type = item.entity_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    if (item.entity_type === 'volunteer_submission' && item.submission_type) {
                        display_type = item.submission_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    } else if (item.entity_type === 'procurement') {
                        display_type = 'Procurement Requisition';
                    }
                    return { ...item, display_type };
                });

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
            if (!['approve', 'reject', 'verify'].includes(action)) {
                return errorResponse('Action must be approve, reject or verify', 400);
            }


            ensurePermission(actor, 'approval.action');

            const approvals = await sql`
                SELECT *
                FROM approvals
                WHERE id::text = ${approval_id}
                LIMIT 1
            `;
            
            let approval;
            let isUnified = false;

            if (approvals.length === 0) {
                // Check unified submissions
                const unified = await sql`
                    SELECT s.*, u.name as requester_name
                    FROM unified_submissions s
                    JOIN users u ON s.submitter_user_id = u.id
                    WHERE s.id::text = ${approval_id}
                    LIMIT 1
                `;
                if (unified.length === 0) return errorResponse('Approval not found', 404);
                
                isUnified = true;
                approval = {
                    ...unified[0],
                    entity_type: 'unified_submission',
                    entity_id: unified[0].id.toString(),
                    requested_by_user_id: unified[0].submitter_user_id
                };
            } else {
                approval = approvals[0];
            }

            if (approval.requested_by_user_id === actor.id) {
                return errorResponse('Requester cannot approve or reject their own transaction', 403);
            }
            if (approval.status !== 'pending' && !isUnified) {
                return errorResponse('Only pending approvals can be actioned', 400);
            }
            if (isUnified && !['submitted', 'verified'].includes(approval.status)) {
                return errorResponse('Only pending submissions can be actioned', 400);
            }


            const finalStatus = action === 'approve' ? 'approved' : 'rejected';
            const procurementColumns = await getProcurementRequestColumns();
            const bidAnalysisEnabled = hasBidAnalysisColumns(procurementColumns);

            await sql.begin(async (tx) => {
                if (isUnified) {
                    let toStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'verified';
                    let currentHandlerRole = null;
                    
                    if (action === 'approve' && approval.submission_type === 'leave_application' && actor.role_code === 'FINANCE_ADMIN_OFFICER') {
                        toStatus = 'verified';
                        currentHandlerRole = 'DIRECTOR';
                    } else if (action === 'verify') {
                        toStatus = 'verified';
                        currentHandlerRole = 'DIRECTOR';
                    } else if (action === 'approve') {
                        toStatus = 'approved';
                        currentHandlerRole = null;
                    }

                    const newSignature = {
                        user_id: actor.id,
                        name: actor.name,
                        role: actor.role_code,
                        action: action,
                        timestamp: new Date().toISOString(),
                        comment: comments
                    };

                    await tx`
                        UPDATE unified_submissions
                        SET status = ${toStatus},
                            current_handler_role = ${currentHandlerRole},
                            signatures = signatures || ${JSON.stringify(newSignature)}::jsonb,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ${approval.id}
                    `;

                    // Handle leave balance update
                    if (toStatus === 'approved' && approval.submission_type === 'leave_application') {
                        const daysRequested = Number(approval.metadata?.days_requested || 0);
                        if (daysRequested > 0) {
                            await tx`
                                UPDATE leave_balances
                                SET used_days = used_days + ${daysRequested},
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE user_id = ${approval.submitter_user_id}
                            `;
                        }
                    }
                } else {
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
                }


                if (approval.entity_type === 'procurement') {
                    const thresholdValue = await loadThresholdValue();
                    const procurementRows = await tx`
                        SELECT *
                        FROM procurement_requests
                        WHERE id::text = ${approval.entity_id}
                        LIMIT 1
                    `;

                    if (procurementRows.length === 0) {
                        throw new HttpError('Linked procurement request not found', 404);
                    }

                    const procurement = procurementRows[0];
                    const policy = buildProcurementPolicy(procurement.total_estimated_cost, thresholdValue);
                    const needsBidAnalysis =
                        policy.approval_band === 'finance_review' || policy.approval_band === 'director_review';

                    if (
                        bidAnalysisEnabled &&
                        action === 'approve' &&
                        needsBidAnalysis &&
                        !['recommended', 'approved', 'waived'].includes(
                            String(procurement.bid_analysis_status || 'pending')
                        )
                    ) {
                        throw new HttpError(
                            'Bid analysis must be completed before approving this procurement request',
                            400
                        );
                    }

                    if (bidAnalysisEnabled) {
                        await tx`
                        UPDATE procurement_requests
                        SET
                            status = ${finalStatus},
                            bid_analysis_status = CASE
                                WHEN ${action === 'approve'} AND bid_analysis_status = 'recommended' THEN 'approved'
                                ELSE bid_analysis_status
                            END,
                            bid_analysis_approved_by_user_id = CASE
                                WHEN ${action === 'approve'} THEN ${actor.id}
                                ELSE bid_analysis_approved_by_user_id
                            END,
                            bid_analysis_approved_at = CASE
                                WHEN ${action === 'approve'} THEN CURRENT_TIMESTAMP
                                ELSE bid_analysis_approved_at
                            END
                        WHERE id::text = ${approval.entity_id}
                        `;
                    } else {
                        await tx`
                            UPDATE procurement_requests
                            SET status = ${finalStatus}
                            WHERE id::text = ${approval.entity_id}
                        `;
                    }
                }

                if (approval.entity_type === 'volunteer_submission' && action === 'approve') {
                    const submissionRows = await tx`
                        SELECT id, type, title, file_name
                        FROM volunteer_submissions
                        WHERE id::text = ${approval.entity_id}
                        LIMIT 1
                    `;

                    if (submissionRows.length > 0 && submissionRows[0].type === 'request_for_funds_plan') {
                        const financeTeam = await tx`
                            SELECT id, name, role_code
                            FROM users
                            WHERE role_code = ANY(${FINANCE_TEAM_ROLES})
                        `;

                        for (const recipient of financeTeam) {
                            await tx`
                                INSERT INTO volunteer_submission_recipients (
                                    submission_id,
                                    user_id,
                                    assigned_by_user_id
                                )
                                VALUES (
                                    ${submissionRows[0].id},
                                    ${recipient.id},
                                    ${actor.id}
                                )
                                ON CONFLICT (submission_id, user_id) DO NOTHING
                            `;
                        }

                        if (financeTeam.length > 0) {
                            await Promise.all(
                                financeTeam.map((recipient) =>
                                    createNotification(tx, {
                                        userId: recipient.id,
                                        type: 'approval_result',
                                        title: 'Approved request-for-funds plan',
                                        message: `${submissionRows[0].title || submissionRows[0].file_name || 'A request-for-funds plan'} has been approved by ${actor.name} and is ready for finance action.`,
                                        relatedEntityType: 'volunteer_submission',
                                        relatedEntityId: String(submissionRows[0].id),
                                        actionUrl: `/reports?submission=${submissionRows[0].id}`,
                                    })
                                )
                            );
                        }
                    }
                }

                if (approval.requested_by_user_id && approval.requested_by_user_id !== actor.id) {
                    await createNotification(tx, {
                        userId: approval.requested_by_user_id,
                        type: 'approval_result',
                        title: `Request ${finalStatus}`,
                        message: `Your ${approval.entity_type.replace(/_/g, ' ')} request was ${finalStatus}${comments ? `: ${comments}` : '.'}`,
                        relatedEntityType: approval.entity_type,
                        relatedEntityId: approval.entity_id,
                        actionUrl:
                            approval.entity_type === 'procurement'
                                ? `/finance?procurement=${approval.entity_id}`
                                : approval.entity_type === 'volunteer_submission'
                                    ? `/reports?submission=${approval.entity_id}`
                                : null,
                    });
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
