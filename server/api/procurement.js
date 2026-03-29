import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams, getPathParam } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    ensurePermission,
} from './utils/rbac.js';

const PROCUREMENT_READ_PERMISSIONS = [
    'expense.read',
    'expense.create',
    'expense.review_finance',
    'approval.read',
];

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

const buildPolicyProfile = (amount, thresholdValue) => {
    const total = Number(amount || 0);
    const reviewFloor = thresholdValue > 0 ? thresholdValue / 2 : 0;

    if (total >= thresholdValue) {
        return {
            approval_band: 'director_review',
            label: 'Director review',
            tone: 'danger',
            quote_requirement: 'minimum_three_quotes',
            control_note: `Director approval required because the requisition exceeds ${thresholdValue.toFixed(2)} USD.`,
        };
    }

    if (total >= reviewFloor) {
        return {
            approval_band: 'finance_review',
            label: 'Finance review',
            tone: 'warning',
            quote_requirement: 'minimum_three_quotes',
            control_note: 'Finance review required before operational release.',
        };
    }

    return {
        approval_band: 'routine_review',
        label: 'Routine review',
        tone: 'success',
        quote_requirement: 'spot_purchase_allowed',
        control_note: 'Routine operational requisition, subject to documentation and budget availability.',
    };
};

const normalizeItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw new HttpError('At least one procurement line item is required', 400);
    }

    return items.map((item, index) => {
        const description = String(item.description || '').trim();
        const quantity = Number.parseFloat(item.quantity);
        const estimatedUnitCost = Number.parseFloat(item.estimated_unit_cost);
        const unit = String(item.unit || '').trim() || 'unit';

        if (!description) {
            throw new HttpError(`Line ${index + 1}: description is required`, 400);
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new HttpError(`Line ${index + 1}: quantity must be greater than zero`, 400);
        }
        if (!Number.isFinite(estimatedUnitCost) || estimatedUnitCost < 0) {
            throw new HttpError(`Line ${index + 1}: unit cost must be zero or greater`, 400);
        }

        return {
            description,
            quantity,
            unit,
            estimated_unit_cost: estimatedUnitCost,
            line_total: quantity * estimatedUnitCost,
        };
    });
};

const loadBudgetControl = async (budgetLineId) => {
    const rows = await sql`
        WITH procurement_control AS (
            SELECT
                budget_line_id,
                COALESCE(SUM(CASE WHEN status IN ('approved', 'ordered') THEN total_estimated_cost ELSE 0 END), 0)::numeric AS committed_amount,
                COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN total_estimated_cost ELSE 0 END), 0)::numeric AS pending_amount
            FROM procurement_requests
            WHERE budget_line_id = ${budgetLineId}
            GROUP BY budget_line_id
        )
        SELECT
            bl.id,
            b.id AS budget_id,
            b.project_id,
            bl.allocated_amount,
            bl.used_amount,
            COALESCE(pc.committed_amount, 0) AS committed_amount,
            COALESCE(pc.pending_amount, 0) AS pending_amount,
            (bl.allocated_amount - bl.used_amount - COALESCE(pc.committed_amount, 0) - COALESCE(pc.pending_amount, 0))::numeric AS available_to_commit
        FROM budget_lines bl
        JOIN budgets b ON bl.budget_id = b.id
        LEFT JOIN procurement_control pc ON pc.budget_line_id = bl.id
        WHERE bl.id = ${budgetLineId}
        LIMIT 1
    `;

    if (rows.length === 0) {
        throw new HttpError('Budget line not found', 404);
    }

    return rows[0];
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const id = getPathParam(event, 'id') || getPathParam(event, 'procurement');
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            ensureAnyPermission(actor, PROCUREMENT_READ_PERMISSIONS, { allowPending: true });
            const thresholdValue = await loadThresholdValue();

            if (id) {
                const rows = await sql`
                    WITH procurement_control AS (
                        SELECT
                            budget_line_id,
                            COALESCE(SUM(CASE WHEN status IN ('approved', 'ordered') THEN total_estimated_cost ELSE 0 END), 0)::numeric AS committed_amount,
                            COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN total_estimated_cost ELSE 0 END), 0)::numeric AS pending_amount
                        FROM procurement_requests
                        WHERE budget_line_id IS NOT NULL
                        GROUP BY budget_line_id
                    )
                    SELECT
                        pr.*,
                        u.name AS requester_name,
                        p.name AS project_name,
                        bl.code AS budget_line_code,
                        bl.description AS budget_line_name,
                        bl.allocated_amount,
                        bl.used_amount,
                        COALESCE(pc.committed_amount, 0) AS committed_amount,
                        COALESCE(pc.pending_amount, 0) AS pending_amount,
                        (bl.allocated_amount - bl.used_amount - COALESCE(pc.committed_amount, 0) - COALESCE(pc.pending_amount, 0))::numeric AS available_to_commit,
                        (SELECT COUNT(*)::int FROM procurement_items WHERE request_id = pr.id) AS item_count
                    FROM procurement_requests pr
                    JOIN users u ON pr.requested_by_user_id = u.id
                    LEFT JOIN projects p ON pr.project_id = p.id
                    LEFT JOIN budget_lines bl ON pr.budget_line_id = bl.id
                    LEFT JOIN procurement_control pc ON pc.budget_line_id = bl.id
                    WHERE pr.id = ${id}
                `;

                if (rows.length === 0) return errorResponse('Request not found', 404);

                const items = await sql`
                    SELECT *
                    FROM procurement_items
                    WHERE request_id = ${id}
                    ORDER BY created_at ASC
                `;

                return successResponse({
                    ...rows[0],
                    items,
                    policy: buildPolicyProfile(rows[0].total_estimated_cost, thresholdValue),
                });
            }

            const rows = await sql`
                WITH procurement_control AS (
                    SELECT
                        budget_line_id,
                        COALESCE(SUM(CASE WHEN status IN ('approved', 'ordered') THEN total_estimated_cost ELSE 0 END), 0)::numeric AS committed_amount,
                        COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN total_estimated_cost ELSE 0 END), 0)::numeric AS pending_amount
                    FROM procurement_requests
                    WHERE budget_line_id IS NOT NULL
                    GROUP BY budget_line_id
                )
                SELECT
                    pr.*,
                    u.name AS requester_name,
                    p.name AS project_name,
                    bl.code AS budget_line_code,
                    bl.description AS budget_line_name,
                    bl.allocated_amount,
                    bl.used_amount,
                    COALESCE(pc.committed_amount, 0) AS committed_amount,
                    COALESCE(pc.pending_amount, 0) AS pending_amount,
                    (bl.allocated_amount - bl.used_amount - COALESCE(pc.committed_amount, 0) - COALESCE(pc.pending_amount, 0))::numeric AS available_to_commit,
                    (SELECT COUNT(*)::int FROM procurement_items WHERE request_id = pr.id) AS item_count,
                    CASE
                        WHEN COALESCE(pr.total_estimated_cost, 0) >= ${thresholdValue} THEN 'director_review'
                        WHEN COALESCE(pr.total_estimated_cost, 0) >= ${thresholdValue / 2} THEN 'finance_review'
                        ELSE 'routine_review'
                    END AS approval_band
                FROM procurement_requests pr
                JOIN users u ON pr.requested_by_user_id = u.id
                LEFT JOIN projects p ON pr.project_id = p.id
                LEFT JOIN budget_lines bl ON pr.budget_line_id = bl.id
                LEFT JOIN procurement_control pc ON pc.budget_line_id = bl.id
                ORDER BY pr.created_at DESC
            `;

            return successResponse(rows);
        }

        if (method === 'POST') {
            ensurePermission(actor, 'expense.create');

            const { project_id, budget_line_id, title, justification } = body;
            const cleanTitle = String(title || '').trim();
            const cleanJustification = String(justification || '').trim();

            if (!cleanTitle) {
                return errorResponse('A requisition title is required', 400);
            }
            if (cleanJustification.length < 15) {
                return errorResponse('Provide a clear procurement justification of at least 15 characters', 400);
            }

            const validatedItems = normalizeItems(body.items);
            const totalCost = validatedItems.reduce((sum, item) => sum + item.line_total, 0);

            if (totalCost <= 0) {
                return errorResponse('Total requisition value must be greater than zero', 400);
            }

            const thresholdValue = await loadThresholdValue();
            const policy = buildPolicyProfile(totalCost, thresholdValue);

            let derivedProjectId = project_id || null;
            let budgetControl = null;
            if (budget_line_id) {
                budgetControl = await loadBudgetControl(budget_line_id);
                derivedProjectId = derivedProjectId || budgetControl.project_id || null;

                if (Number(totalCost) > Number(budgetControl.available_to_commit || 0)) {
                    return errorResponse(
                        'Requested amount exceeds the budget line balance available for new commitments',
                        400
                    );
                }
            }

            const result = await sql.begin(async (tx) => {
                const insertedRequest = await tx`
                    INSERT INTO procurement_requests (
                        requested_by_user_id,
                        project_id,
                        budget_line_id,
                        title,
                        justification,
                        total_estimated_cost,
                        status
                    )
                    VALUES (
                        ${actor.id},
                        ${derivedProjectId},
                        ${budget_line_id || null},
                        ${cleanTitle},
                        ${cleanJustification},
                        ${totalCost},
                        'pending_approval'
                    )
                    RETURNING id
                `;

                for (const item of validatedItems) {
                    await tx`
                        INSERT INTO procurement_items (
                            request_id,
                            description,
                            quantity,
                            unit,
                            estimated_unit_cost
                        )
                        VALUES (
                            ${insertedRequest[0].id},
                            ${item.description},
                            ${item.quantity},
                            ${item.unit},
                            ${item.estimated_unit_cost}
                        )
                    `;
                }

                await tx`
                    INSERT INTO approvals (
                        entity_type,
                        entity_id,
                        requested_by_user_id,
                        status
                    )
                    VALUES ('procurement', ${insertedRequest[0].id}, ${actor.id}, 'pending')
                `;

                return insertedRequest[0];
            });

            return successResponse(
                {
                    message: 'Procurement request submitted for approval',
                    id: result.id,
                    total_estimated_cost: totalCost,
                    policy,
                    budget_control: budgetControl,
                },
                201
            );
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Procurement function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
