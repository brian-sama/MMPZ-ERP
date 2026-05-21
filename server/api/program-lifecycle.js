import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    canSeeOrganizationFinance,
    canSeeOrganizationIndicators,
} from './utils/rbac.js';

const FINANCE_REVIEW_ROLES = [
    'FINANCE_OFFICER',
    'ADMIN_FINANCE_ASSISTANT',
    'FINANCE_ADMIN_OFFICER',
    'ADMIN_ASSISTANT',
    'LOGISTICS_ASSISTANT',
];

const tableExists = async (tableName) => {
    const rows = await sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = ${tableName}
        ) AS exists
    `;
    return Boolean(rows[0]?.exists);
};

const columnExists = async (tableName, columnName) => {
    const rows = await sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = ${tableName}
              AND column_name = ${columnName}
        ) AS exists
    `;
    return Boolean(rows[0]?.exists);
};

const safeRole = (roleCode) => String(roleCode || '').replace(/'/g, "''");

const scopedProjectFilter = (actor, alias = 'p') => {
    if (canSeeOrganizationFinance(actor) || canSeeOrganizationIndicators(actor)) return '';
    const actorId = Number(actor.id);
    return `
        AND (
            ${alias}.owner_user_id = ${actorId}
            OR EXISTS (
                SELECT 1
                FROM project_assignments pa
                WHERE pa.project_id = ${alias}.id
                  AND pa.user_id = ${actorId}
                  AND pa.is_active = TRUE
            )
        )
    `;
};

const scopedFieldActivityFilter = (actor, alias = 'fa', projectAlias = 'p') => {
    if (canSeeOrganizationFinance(actor) || canSeeOrganizationIndicators(actor)) return '';
    const actorId = Number(actor.id);
    return `
        AND (
            ${alias}.facilitator_id = ${actorId}
            OR ${alias}.assigned_reviewer_id = ${actorId}
            OR (
                ${projectAlias}.id IS NOT NULL
                ${scopedProjectFilter(actor, projectAlias)}
            )
        )
    `;
};

const scopedFinanceFilter = (actor, requestAlias, projectAlias = 'p') => {
    if (canSeeOrganizationFinance(actor)) return '';
    const actorId = Number(actor.id);
    return `
        AND (
            ${requestAlias}.requested_by_user_id = ${actorId}
            OR (
                ${projectAlias}.id IS NOT NULL
                ${scopedProjectFilter(actor, projectAlias)}
            )
        )
    `;
};

const scopedSubmissionFilter = (actor, alias = 's') => {
    if (canSeeOrganizationFinance(actor) || canSeeOrganizationIndicators(actor)) return '';
    const actorId = Number(actor.id);
    const roleCode = safeRole(actor.role_code);

    if (FINANCE_REVIEW_ROLES.includes(actor.role_code)) {
        const financeRoles = FINANCE_REVIEW_ROLES.map((role) => `'${role}'`).join(', ');
        return `
            AND (
                ${alias}.current_handler_role IN (${financeRoles})
                OR ${alias}.submitter_user_id = ${actorId}
                OR ${alias}.current_handler_user_id = ${actorId}
            )
        `;
    }

    return `
        AND (
            ${alias}.submitter_user_id = ${actorId}
            OR ${alias}.current_handler_user_id = ${actorId}
            OR ${alias}.current_handler_role = '${roleCode}'
        )
    `;
};

const firstRow = (rows, fallback = {}) => rows[0] || fallback;
const asNumber = (value) => Number(value || 0);

const loadProjects = async (actor) => {
    if (!(await tableExists('projects'))) {
        return { project_count: 0, planning_count: 0, active_count: 0, completed_count: 0 };
    }

    return firstRow(await sql.unsafe(`
        SELECT
            COUNT(*)::int AS project_count,
            COUNT(*) FILTER (WHERE status = 'planning')::int AS planning_count,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count
        FROM projects p
        WHERE 1=1
        ${scopedProjectFilter(actor, 'p')}
    `));
};

const loadFieldActivities = async (actor) => {
    if (!(await tableExists('field_activities'))) {
        return {
            activity_count: 0,
            draft_count: 0,
            submitted_count: 0,
            reviewed_count: 0,
            verified_count: 0,
        };
    }

    return firstRow(await sql.unsafe(`
        SELECT
            COUNT(*)::int AS activity_count,
            COUNT(*) FILTER (WHERE fa.status = 'draft')::int AS draft_count,
            COUNT(*) FILTER (WHERE fa.status = 'submitted')::int AS submitted_count,
            COUNT(*) FILTER (WHERE fa.status = 'reviewed')::int AS reviewed_count,
            COUNT(*) FILTER (WHERE fa.status = 'verified')::int AS verified_count
        FROM field_activities fa
        LEFT JOIN projects p ON p.id = fa.project_id
        WHERE 1=1
        ${scopedFieldActivityFilter(actor, 'fa', 'p')}
    `));
};

const loadFinance = async (actor) => {
    const hasBudgets = await tableExists('budgets');
    const hasBudgetLines = await tableExists('budget_lines');
    const hasProcurement = await tableExists('procurement_requests');
    const hasExpenses = await tableExists('expense_requests');

    const budget = hasBudgets && hasBudgetLines
        ? firstRow(await sql.unsafe(`
            SELECT
                COUNT(DISTINCT b.id)::int AS budget_count,
                COUNT(bl.id)::int AS budget_line_count,
                COALESCE(SUM(bl.allocated_amount), 0)::numeric AS allocated_total,
                COALESCE(SUM(bl.used_amount), 0)::numeric AS spent_total
            FROM budget_lines bl
            JOIN budgets b ON b.id = bl.budget_id
            LEFT JOIN projects p ON p.id = b.project_id
            WHERE 1=1
            ${scopedProjectFilter(actor, 'p')}
        `))
        : { budget_count: 0, budget_line_count: 0, allocated_total: 0, spent_total: 0 };

    const procurement = hasProcurement
        ? firstRow(await sql.unsafe(`
            SELECT
                COUNT(*)::int AS procurement_count,
                COUNT(*) FILTER (WHERE pr.status = 'pending_approval')::int AS procurement_pending_count,
                COUNT(*) FILTER (WHERE pr.status IN ('approved', 'ordered'))::int AS procurement_open_count,
                COUNT(*) FILTER (WHERE pr.status = 'received')::int AS procurement_received_count,
                COALESCE(SUM(CASE WHEN pr.status IN ('approved', 'ordered') THEN pr.total_estimated_cost ELSE 0 END), 0)::numeric AS committed_procurement_total,
                COALESCE(SUM(CASE WHEN pr.status = 'pending_approval' THEN pr.total_estimated_cost ELSE 0 END), 0)::numeric AS pending_procurement_total
            FROM procurement_requests pr
            LEFT JOIN projects p ON p.id = pr.project_id
            WHERE 1=1
            ${scopedFinanceFilter(actor, 'pr', 'p')}
        `))
        : {
            procurement_count: 0,
            procurement_pending_count: 0,
            procurement_open_count: 0,
            procurement_received_count: 0,
            committed_procurement_total: 0,
            pending_procurement_total: 0,
        };

    const expenses = hasExpenses
        ? firstRow(await sql.unsafe(`
            SELECT
                COUNT(*)::int AS expense_count,
                COUNT(*) FILTER (WHERE er.status = 'pending_finance_review')::int AS pending_finance_review_count,
                COUNT(*) FILTER (WHERE er.status = 'pending_director_approval')::int AS pending_director_approval_count,
                COUNT(*) FILTER (WHERE er.status = 'approved')::int AS approved_expense_count,
                COUNT(*) FILTER (WHERE er.status = 'paid')::int AS paid_expense_count,
                COALESCE(SUM(CASE WHEN er.status = 'approved' THEN er.amount ELSE 0 END), 0)::numeric AS approved_expense_total,
                COALESCE(SUM(CASE WHEN er.status = 'paid' THEN er.amount ELSE 0 END), 0)::numeric AS paid_expense_total
            FROM expense_requests er
            LEFT JOIN projects p ON p.id = er.project_id
            WHERE 1=1
            ${scopedFinanceFilter(actor, 'er', 'p')}
        `))
        : {
            expense_count: 0,
            pending_finance_review_count: 0,
            pending_director_approval_count: 0,
            approved_expense_count: 0,
            paid_expense_count: 0,
            approved_expense_total: 0,
            paid_expense_total: 0,
        };

    return { ...budget, ...procurement, ...expenses };
};

const loadSubmissions = async (actor) => {
    if (!(await tableExists('unified_submissions'))) {
        return {
            submission_count: 0,
            submitted_count: 0,
            verified_count: 0,
            approved_count: 0,
            returned_count: 0,
        };
    }

    return firstRow(await sql.unsafe(`
        SELECT
            COUNT(*)::int AS submission_count,
            COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted_count,
            COUNT(*) FILTER (WHERE status = 'verified')::int AS verified_count,
            COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count,
            COUNT(*) FILTER (WHERE status IN ('pending_changes', 'rejected'))::int AS returned_count
        FROM unified_submissions s
        WHERE 1=1
        ${scopedSubmissionFilter(actor, 's')}
    `));
};

const loadApprovals = async (actor) => {
    if (!(await tableExists('approvals'))) {
        return { approval_count: 0, pending_approval_count: 0, rejected_approval_count: 0 };
    }

    if (canSeeOrganizationFinance(actor) || canSeeOrganizationIndicators(actor)) {
        return firstRow(await sql`
            SELECT
                COUNT(*)::int AS approval_count,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_approval_count,
                COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_approval_count
            FROM approvals
        `);
    }

    return firstRow(await sql`
        SELECT
            COUNT(*)::int AS approval_count,
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_approval_count,
            COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_approval_count
        FROM approvals
        WHERE requested_by_user_id = ${actor.id}
    `);
};

const loadDocuments = async () => {
    if (!(await tableExists('document_library_files'))) {
        return {
            document_count: 0,
            traceability_ready: false,
            linked_document_count: 0,
            physical_received_count: 0,
            verified_document_count: 0,
        };
    }

    const hasRelatedEntityType = await columnExists('document_library_files', 'related_entity_type');
    const hasPhysicalCopy = await columnExists('document_library_files', 'physical_copy_received');
    const hasApprovalStatus = await columnExists('document_library_files', 'approval_status');

    const base = firstRow(await sql`
        SELECT COUNT(*)::int AS document_count
        FROM document_library_files
    `);

    if (!hasRelatedEntityType && !hasPhysicalCopy && !hasApprovalStatus) {
        return {
            ...base,
            traceability_ready: false,
            linked_document_count: 0,
            physical_received_count: 0,
            verified_document_count: 0,
        };
    }

    const linkedExpression = hasRelatedEntityType
        ? "COUNT(*) FILTER (WHERE related_entity_type IS NOT NULL)::int"
        : '0::int';
    const physicalExpression = hasPhysicalCopy
        ? "COUNT(*) FILTER (WHERE physical_copy_received = TRUE)::int"
        : '0::int';
    const verifiedExpression = hasApprovalStatus
        ? "COUNT(*) FILTER (WHERE approval_status IN ('verified', 'approved'))::int"
        : '0::int';

    const rows = await sql.unsafe(`
        SELECT
            COUNT(*)::int AS document_count,
            ${linkedExpression} AS linked_document_count,
            ${physicalExpression} AS physical_received_count,
            ${verifiedExpression} AS verified_document_count
        FROM document_library_files
    `);

    return {
        ...rows[0],
        traceability_ready: hasRelatedEntityType && hasPhysicalCopy && hasApprovalStatus,
    };
};

const loadRecentSignals = async (actor) => {
    const selects = [];

    if (await tableExists('field_activities')) {
        selects.push(`
            SELECT
                'field_activity' AS source,
                COALESCE(NULLIF(fa.description, ''), 'Field activity') AS title,
                fa.status,
                fa.updated_at AS signal_at
            FROM field_activities fa
            LEFT JOIN projects p ON p.id = fa.project_id
            WHERE 1=1
            ${scopedFieldActivityFilter(actor, 'fa', 'p')}
        `);
    }

    if (await tableExists('unified_submissions')) {
        selects.push(`
            SELECT
                'submission' AS source,
                COALESCE(NULLIF(s.title, ''), s.submission_type) AS title,
                s.status,
                s.updated_at AS signal_at
            FROM unified_submissions s
            WHERE 1=1
            ${scopedSubmissionFilter(actor, 's')}
        `);
    }

    if (await tableExists('procurement_requests')) {
        selects.push(`
            SELECT
                'procurement' AS source,
                pr.title,
                pr.status,
                pr.created_at AS signal_at
            FROM procurement_requests pr
            LEFT JOIN projects p ON p.id = pr.project_id
            WHERE 1=1
            ${scopedFinanceFilter(actor, 'pr', 'p')}
        `);
    }

    if (selects.length === 0) return [];

    return sql.unsafe(`
        SELECT *
        FROM (
            ${selects.join('\nUNION ALL\n')}
        ) signals
        ORDER BY signal_at DESC NULLS LAST
        LIMIT 8
    `);
};

const buildStages = ({ projects, activities, finance, submissions, approvals, documents }) => [
    {
        id: 'plan',
        label: 'Plan',
        owner: 'ERP',
        tone: 'primary',
        count: asNumber(projects.planning_count) + asNumber(activities.draft_count),
        status: 'Planning records',
        note: 'Concepts, project scope, activity intent, ownership, and readiness.',
    },
    {
        id: 'budget',
        label: 'Budget',
        owner: 'ERP Finance',
        tone: 'success',
        count: asNumber(finance.budget_line_count),
        status: 'Budget lines',
        note: 'Grant budgets, approved allocations, and available balance controls.',
    },
    {
        id: 'approve',
        label: 'Approve',
        owner: 'Governance',
        tone: 'warning',
        count: asNumber(approvals.pending_approval_count) + asNumber(submissions.submitted_count),
        status: 'Pending controls',
        note: 'Finance review, Director approval, and returned-for-correction loops.',
    },
    {
        id: 'release',
        label: 'Release',
        owner: 'Finance',
        tone: 'info',
        count: asNumber(finance.approved_expense_count) + asNumber(finance.paid_expense_count),
        status: 'Approved or paid',
        note: 'Funds released or ready for operational use after authorization.',
    },
    {
        id: 'prepare',
        label: 'Prepare',
        owner: 'Admin & Logistics',
        tone: 'warning',
        count: asNumber(finance.procurement_pending_count) + asNumber(finance.procurement_open_count),
        status: 'Procurement items',
        note: 'Goods, transport, checklists, registers, and deployment materials.',
    },
    {
        id: 'implement',
        label: 'Implement',
        owner: 'Field Teams',
        tone: 'primary',
        count: asNumber(activities.activity_count),
        status: 'Field activities',
        note: 'Assignments, participant lists, forms, evidence, and sync to Compass.',
    },
    {
        id: 'submit',
        label: 'Submit',
        owner: 'Staff & Mobile',
        tone: 'info',
        count: asNumber(submissions.submission_count),
        status: 'Unified submissions',
        note: 'Reports, requests, evidence, and activity documents enter workflow.',
    },
    {
        id: 'liquidate',
        label: 'Liquidate',
        owner: 'Finance & Admin',
        tone: 'danger',
        count: asNumber(finance.paid_expense_count),
        status: 'Paid records',
        note: 'Receipts, vouchers, balances, and financial closure need a dedicated module.',
    },
    {
        id: 'verify',
        label: 'Verify',
        owner: 'Compass & Governance',
        tone: 'warning',
        count: asNumber(submissions.verified_count) + asNumber(activities.verified_count),
        status: 'Verified records',
        note: 'QA, corrections, evidence validation, and management sign-off.',
    },
    {
        id: 'publish',
        label: 'Publish',
        owner: 'M&E',
        tone: 'success',
        count: asNumber(submissions.approved_count),
        status: 'Approved records',
        note: 'Approved data becomes reportable and available for analytics.',
    },
    {
        id: 'replan',
        label: 'Replan',
        owner: 'Leadership',
        tone: 'primary',
        count: asNumber(projects.active_count) + asNumber(projects.completed_count),
        status: 'Decision base',
        note: 'Reports and analytics feed the next planning and budgeting cycle.',
    },
];

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        if (event.httpMethod !== 'GET') {
            return errorResponse('Method not allowed', 405);
        }

        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event) || query.userId);
        ensureAnyPermission(
            actor,
            ['project.read', 'indicator.read_all', 'indicator.read_assigned', 'expense.read', 'approval.read', 'activity.read'],
            { allowPending: true }
        );

        const [projects, activities, finance, submissions, approvals, documents, recentSignals] = await Promise.all([
            loadProjects(actor),
            loadFieldActivities(actor),
            loadFinance(actor),
            loadSubmissions(actor),
            loadApprovals(actor),
            loadDocuments(),
            loadRecentSignals(actor),
        ]);

        const stages = buildStages({ projects, activities, finance, submissions, approvals, documents });
        const allocatedTotal = asNumber(finance.allocated_total);
        const spentTotal = asNumber(finance.spent_total);
        const committedTotal = asNumber(finance.committed_procurement_total);
        const pendingProcurementTotal = asNumber(finance.pending_procurement_total);

        return successResponse({
            model: {
                name: 'Programmatic Operational Cycle',
                thesis: 'ERP owns authorization and accountability; mobile executes field work; Compass validates evidence and publishes reportable data.',
                cycle: stages.map((stage) => stage.label),
            },
            summary: {
                project_count: asNumber(projects.project_count),
                activity_count: asNumber(activities.activity_count),
                pending_control_count:
                    asNumber(approvals.pending_approval_count) +
                    asNumber(submissions.submitted_count) +
                    asNumber(finance.pending_finance_review_count) +
                    asNumber(finance.pending_director_approval_count),
                open_finance_count:
                    asNumber(finance.procurement_pending_count) +
                    asNumber(finance.procurement_open_count) +
                    asNumber(finance.approved_expense_count),
                document_count: asNumber(documents.document_count),
                available_balance_total: allocatedTotal - spentTotal - committedTotal - pendingProcurementTotal,
            },
            finance: {
                ...finance,
                available_balance_total: allocatedTotal - spentTotal - committedTotal - pendingProcurementTotal,
            },
            projects,
            activities,
            submissions,
            approvals,
            documents,
            stages,
            recentSignals,
            architectureGaps: [
                {
                    key: 'activity_financial_profile',
                    status: 'partial',
                    title: 'Activity financial profile',
                    note: 'Budget, procurement, expense, and field activity records exist but need a single activity lifecycle header.',
                },
                {
                    key: 'liquidation_management',
                    status: 'missing',
                    title: 'Liquidation management',
                    note: 'Paid expenses are tracked, but receipts, vouchers, outstanding balances, and financial closure need first-class tables.',
                },
                {
                    key: 'document_traceability',
                    status: documents.traceability_ready ? 'ready' : 'partial',
                    title: 'Document traceability',
                    note: documents.traceability_ready
                        ? 'Document library has fields needed for linked digital and physical controls.'
                        : 'Documents upload correctly, but linked entity, document type, verification, and physical-copy tracking are not yet complete.',
                },
                {
                    key: 'publication_layer',
                    status: 'partial',
                    title: 'Publication layer',
                    note: 'Approvals exist, but published/reportable states should be explicit for Compass and analytics.',
                },
            ],
        });
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Program lifecycle API error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
