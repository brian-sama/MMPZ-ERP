import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams, getPathParam } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    setAuditActor,
} from './utils/rbac.js';

const THRESHOLD_KEY = 'major_finance_threshold_usd';

const getThreshold = async () => {
    const rows = await sql`
        SELECT value_text
        FROM system_settings
        WHERE setting_key = ${THRESHOLD_KEY}
        LIMIT 1
    `;
    if (rows.length === 0) return 500.0;
    const value = Number.parseFloat(rows[0].value_text);
    return Number.isNaN(value) ? 500.0 : value;
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const id = getPathParam(event, 'id') || getPathParam(event, 'expenses');
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            ensurePermission(actor, 'expense.read', { allowPending: true });

            const rows = id
                ? await sql`
                    SELECT er.*, p.name AS project_name, u.name AS requested_by_name
                    FROM expense_requests er
                    LEFT JOIN projects p ON er.project_id = p.id
                    LEFT JOIN users u ON er.requested_by_user_id = u.id
                    WHERE er.id = ${id}
                    LIMIT 1
                `
                : await sql`
                    SELECT er.*, p.name AS project_name, u.name AS requested_by_name
                    FROM expense_requests er
                    LEFT JOIN projects p ON er.project_id = p.id
                    LEFT JOIN users u ON er.requested_by_user_id = u.id
                    ORDER BY er.created_at DESC
                `;

            if (id && rows.length === 0) return errorResponse('Expense request not found', 404);
            return successResponse(id ? rows[0] : rows);
        }

        if (method === 'POST') {
            ensurePermission(actor, 'expense.create');

            const amount = Number.parseFloat(body.amount);
            if (!body.description || Number.isNaN(amount) || amount < 0) {
                return errorResponse('description and valid non-negative amount are required', 400);
            }

            const inserted = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                const rows = await tx`
                    INSERT INTO expense_requests (
                        project_id,
                        related_indicator_id,
                        requested_by_user_id,
                        description,
                        category,
                        amount,
                        currency,
                        status,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        ${body.project_id || null},
                        ${body.related_indicator_id || null},
                        ${actor.id},
                        ${body.description},
                        ${body.category || 'other'},
                        ${amount},
                        ${body.currency || 'USD'},
                        ${body.status || 'draft'},
                        ${new Date().toISOString()},
                        ${new Date().toISOString()}
                    )
                    RETURNING *
                `;
                return rows[0];
            });

            return successResponse({
                message: 'Expense request created successfully',
                expense: inserted,
            });
        }

        if (method === 'PATCH') {
            if (!id) return errorResponse('Expense request ID is required', 400);
            const { action, rejection_reason } = body;
            if (!action) return errorResponse('action is required', 400);

            const rows = await sql`
                SELECT *
                FROM expense_requests
                WHERE id = ${id}
                LIMIT 1
            `;
            if (rows.length === 0) return errorResponse('Expense request not found', 404);
            const expense = rows[0];
            const threshold = await getThreshold();

            if (action === 'submit') {
                ensurePermission(actor, 'expense.create');
                if (expense.requested_by_user_id !== actor.id && actor.role_code !== 'DIRECTOR') {
                    return errorResponse('Only requester or Director can submit this expense', 403);
                }
                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`
                        UPDATE expense_requests
                        SET status = 'pending_finance_review', updated_at = ${new Date().toISOString()}
                        WHERE id = ${id}
                    `;
                });
                return successResponse({ message: 'Expense submitted for finance review' });
            }

            if (action === 'finance_review_approve') {
                ensurePermission(actor, 'expense.review_finance');
                const nextStatus =
                    Number(expense.amount) >= Number(threshold)
                        ? 'pending_director_approval'
                        : 'approved';
                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`
                        UPDATE expense_requests
                        SET
                            status = ${nextStatus},
                            reviewed_by_user_id = ${actor.id},
                            review_at = ${new Date().toISOString()},
                            updated_at = ${new Date().toISOString()}
                        WHERE id = ${id}
                    `;
                });
                return successResponse({
                    message:
                        nextStatus === 'pending_director_approval'
                            ? 'Finance review complete. Awaiting Director approval.'
                            : 'Expense approved by Finance.',
                });
            }

            if (action === 'finance_review_reject') {
                ensurePermission(actor, 'expense.review_finance');
                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`
                        UPDATE expense_requests
                        SET
                            status = 'rejected',
                            reviewed_by_user_id = ${actor.id},
                            review_at = ${new Date().toISOString()},
                            rejection_reason = ${rejection_reason || 'Rejected during finance review'},
                            updated_at = ${new Date().toISOString()}
                        WHERE id = ${id}
                    `;
                });
                return successResponse({ message: 'Expense rejected by Finance' });
            }

            if (action === 'director_approve') {
                ensurePermission(actor, 'expense.approve_director');
                if (actor.role_code !== 'DIRECTOR') {
                    return errorResponse('Only Director can perform final approval', 403);
                }

                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`
                        UPDATE expense_requests
                        SET
                            status = 'approved',
                            approved_by_user_id = ${actor.id},
                            director_decision_at = ${new Date().toISOString()},
                            updated_at = ${new Date().toISOString()}
                        WHERE id = ${id}
                    `;
                });

                return successResponse({ message: 'Expense approved by Director' });
            }

            if (action === 'director_reject') {
                ensurePermission(actor, 'expense.approve_director');
                if (actor.role_code !== 'DIRECTOR') {
                    return errorResponse('Only Director can perform final approval', 403);
                }

                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`
                        UPDATE expense_requests
                        SET
                            status = 'rejected',
                            approved_by_user_id = ${actor.id},
                            director_decision_at = ${new Date().toISOString()},
                            rejection_reason = ${rejection_reason || 'Rejected by Director'},
                            updated_at = ${new Date().toISOString()}
                        WHERE id = ${id}
                    `;
                });

                return successResponse({ message: 'Expense rejected by Director' });
            }

            if (action === 'mark_paid') {
                ensurePermission(actor, 'expense.pay');
                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`
                        UPDATE expense_requests
                        SET
                            status = 'paid',
                            paid_at = ${new Date().toISOString()},
                            updated_at = ${new Date().toISOString()}
                        WHERE id = ${id}
                    `;
                });
                return successResponse({ message: 'Expense marked as paid' });
            }

            return errorResponse('Unsupported action', 400);
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Expenses function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
