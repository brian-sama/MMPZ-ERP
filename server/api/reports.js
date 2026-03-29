import { sql } from './utils/db.js';
import {
    errorResponse,
    corsResponse,
    getQueryParams,
} from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    hasPermission,
} from './utils/rbac.js';

const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'Content-Disposition',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const csvEscape = (value) => {
    const normalized = value === null || value === undefined ? '' : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
};

const buildCsv = (rows) => {
    const headers = [
        'ID',
        'Indicator',
        'Project',
        'Target',
        'Current',
        'ProgressPercent',
        'TotalBudget',
        'BudgetBalance',
        'Status',
        'Priority',
        'Owner',
        'CreatedAt',
    ];

    const dataLines = rows.map((row) => {
        const progress = Number(row.target_value) > 0
            ? Math.round((Number(row.current_value) / Number(row.target_value)) * 100)
            : 0;

        return [
            csvEscape(row.id),
            csvEscape(row.title),
            csvEscape(row.project_name),
            csvEscape(row.target_value),
            csvEscape(row.current_value),
            csvEscape(progress),
            csvEscape(row.total_budget),
            csvEscape(row.current_budget_balance),
            csvEscape(row.status),
            csvEscape(row.priority),
            csvEscape(row.owner_name),
            csvEscape(row.created_at),
        ].join(',');
    });

    return [headers.join(','), ...dataLines].join('\n');
};

const buildHtmlReport = (rows) => {
    const generatedAt = new Date().toISOString();
    const bodyRows = rows.map((row) => {
        const progress = Number(row.target_value) > 0
            ? Math.round((Number(row.current_value) / Number(row.target_value)) * 100)
            : 0;

        return `
            <tr>
                <td>${row.id}</td>
                <td>${row.title || ''}</td>
                <td>${row.project_name || ''}</td>
                <td>${row.current_value || 0} / ${row.target_value || 0}</td>
                <td>${progress}%</td>
                <td>${row.current_budget_balance || 0}</td>
                <td>${row.status || ''}</td>
            </tr>
        `;
    }).join('');

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>MMPZ ERP Indicator Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
    h1 { margin: 0 0 8px; }
    p { margin: 0 0 16px; color: #4b5563; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>MMPZ ERP Indicators Report</h1>
  <p>Generated at ${generatedAt}</p>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Indicator</th>
        <th>Project</th>
        <th>Progress</th>
        <th>%</th>
        <th>Budget Balance</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
};

const loadIndicatorsForActor = async (actor) => {
    let query = sql`
        SELECT
            i.id,
            i.title,
            i.target_value,
            i.current_value,
            i.total_budget,
            i.current_budget_balance,
            i.status,
            i.priority,
            i.created_at,
            p.name AS project_name,
            u.name AS owner_name
        FROM indicators i
        LEFT JOIN projects p ON i.project_id = p.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        WHERE 1=1
    `;

    const shouldRestrictScope =
        actor.is_pending_reassignment || !hasPermission(actor, 'indicator.read_all');

    if (shouldRestrictScope) {
        query = sql`${query}
            AND (
                i.created_by_user_id = ${actor.id}
                OR EXISTS (
                    SELECT 1
                    FROM project_assignments pa
                    WHERE pa.project_id = i.project_id
                      AND pa.user_id = ${actor.id}
                      AND pa.is_active = TRUE
                )
            )
        `;
    }

    query = sql`${query} ORDER BY i.created_at DESC`;
    return query;
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();
    if (event.httpMethod !== 'GET') return errorResponse('Method not allowed', 405);

    try {
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event) || query.userId);
        ensureAnyPermission(actor, ['indicator.read_all', 'indicator.read_assigned'], {
            allowPending: true,
        });

        const rows = await loadIndicatorsForActor(actor);
        const path = event.path || '';

        if (path.includes('/reports/pdf')) {
            return {
                statusCode: 200,
                headers: {
                    ...baseHeaders,
                    'Content-Type': 'text/html; charset=utf-8',
                },
                body: buildHtmlReport(rows),
            };
        }

        if (path.includes('/reports/excel') || path.includes('/export/indicators')) {
            return {
                statusCode: 200,
                headers: {
                    ...baseHeaders,
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename=\"mmpz_indicators_export.csv\"',
                },
                body: buildCsv(rows),
            };
        }

        return errorResponse('Unsupported report route', 404);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Reports API error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
