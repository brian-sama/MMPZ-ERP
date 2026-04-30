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

const htmlEscape = (value) => {
    const normalized = value === null || value === undefined ? '' : String(value);
    return normalized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const formatCurrency = (value) =>
    `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const calculateRisk = (row) => {
    const progress = Number(row.progress_percentage || 0);
    const budgetUsed = Number(row.budget_utilization_percent || 0);
    const daysSinceUpdate = Number(row.days_since_update || 0);
    let score = 0;

    if (progress < 50 && budgetUsed > 80) score += 50;
    if (daysSinceUpdate > 30) score += 30;
    if (row.status === 'flagged') score += 20;
    if (row.priority === 'critical') score += 10;

    return Math.min(score, 100);
};

const riskLevel = (score) => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
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
        'BudgetUsedPercent',
        'RiskLevel',
        'RiskScore',
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
            csvEscape(row.budget_utilization_percent),
            csvEscape(row.risk_level),
            csvEscape(row.auto_risk_score),
            csvEscape(row.owner_name),
            csvEscape(row.created_at),
        ].join(',');
    });

    return [headers.join(','), ...dataLines].join('\n');
};

const buildHtmlReport = (rows, reportType = 'me_monthly') => {
    const generatedAt = new Date().toISOString();
    const totals = rows.reduce((acc, row) => {
        acc.target += Number(row.target_value || 0);
        acc.current += Number(row.current_value || 0);
        acc.budget += Number(row.total_budget || 0);
        acc.remaining += Number(row.current_budget_balance || 0);
        acc.spent += Number(row.spent_amount || 0);
        if (row.risk_level === 'high') acc.highRisk += 1;
        return acc;
    }, { target: 0, current: 0, budget: 0, remaining: 0, spent: 0, highRisk: 0 });

    const reportTitles = {
        me_monthly: 'M&E Monthly Progress Report',
        finance_utilization: 'Finance Utilization Report',
        facilitator_activity: 'Facilitator Field Activity Report',
        procurement_audit: 'Procurement Audit Trail',
    };

    const recommendations = [
        totals.highRisk > 0
            ? `${totals.highRisk} high-risk indicator${totals.highRisk === 1 ? '' : 's'} need management attention.`
            : 'No high-risk indicators were detected in this reporting scope.',
        totals.budget > 0 && totals.remaining / totals.budget < 0.2
            ? 'Budget pressure is elevated; review commitments before approving additional spend.'
            : 'Budget pressure is within an acceptable monitoring range.',
        'Review stale indicators and require fresh field evidence where updates are older than 30 days.',
    ];

    const bodyRows = rows.map((row) => {
        return `
            <tr>
                <td>${htmlEscape(row.title)}</td>
                <td>${htmlEscape(row.program_name || 'Unassigned')}</td>
                <td>${htmlEscape(row.project_name || 'Unassigned')}</td>
                <td>${row.current_value || 0} / ${row.target_value || 0}</td>
                <td>${row.progress_percentage}%</td>
                <td>${formatCurrency(row.total_budget)}</td>
                <td>${formatCurrency(row.spent_amount)}</td>
                <td>${formatCurrency(row.current_budget_balance)}</td>
                <td><span class="risk ${row.risk_level}">${row.risk_level}</span></td>
            </tr>
        `;
    }).join('');

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${htmlEscape(reportTitles[reportType] || 'MMPZ ERP Report')}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 28px; color: #1d2a23; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    h2 { margin: 26px 0 10px; font-size: 16px; }
    p { margin: 0 0 16px; color: #45564d; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 0 24px; }
    .metric { border: 1px solid #d9cfbd; border-radius: 8px; padding: 12px; background: #fffdf7; }
    .metric-label { font-size: 10px; text-transform: uppercase; color: #728076; font-weight: bold; }
    .metric-value { font-size: 18px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
    th { background: #f7f1e6; }
    .risk { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .risk.high { color: #b42318; background: rgba(180,35,24,.1); }
    .risk.medium { color: #b7791f; background: rgba(183,121,31,.12); }
    .risk.low { color: #2f5d50; background: rgba(47,93,80,.12); }
    li { margin-bottom: 6px; color: #45564d; }
  </style>
</head>
<body>
  <h1>${htmlEscape(reportTitles[reportType] || 'MMPZ ERP Report')}</h1>
  <p>Generated at ${generatedAt}</p>
  <div class="summary">
    <div class="metric"><div class="metric-label">Target</div><div class="metric-value">${totals.target.toLocaleString()}</div></div>
    <div class="metric"><div class="metric-label">Reached</div><div class="metric-value">${totals.current.toLocaleString()}</div></div>
    <div class="metric"><div class="metric-label">Budget Used</div><div class="metric-value">${formatCurrency(totals.spent)}</div></div>
    <div class="metric"><div class="metric-label">High Risk</div><div class="metric-value">${totals.highRisk}</div></div>
  </div>
  <h2>Indicator And Budget Performance</h2>
  <table>
    <thead>
      <tr>
        <th>Indicator</th>
        <th>Program</th>
        <th>Project</th>
        <th>Progress</th>
        <th>%</th>
        <th>Allocated</th>
        <th>Spent</th>
        <th>Remaining</th>
        <th>Risk</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <h2>Recommendations</h2>
  <ul>${recommendations.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul>
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
            pg.name AS program_name,
            COALESCE(a.activity_spent, GREATEST(i.total_budget - i.current_budget_balance, 0))::float AS spent_amount,
            CASE WHEN i.target_value > 0 THEN ROUND((COALESCE(i.current_value, 0)::float / i.target_value::float) * 100) ELSE 0 END AS progress_percentage,
            CASE WHEN i.total_budget > 0 THEN ROUND(((i.total_budget - i.current_budget_balance)::float / i.total_budget::float) * 100) ELSE 0 END AS budget_utilization_percent,
            GREATEST(EXTRACT(DAY FROM (NOW() - COALESCE(i.last_updated, i.created_at))), 0)::int AS days_since_update,
            u.name AS owner_name
        FROM indicators i
        LEFT JOIN projects p ON i.project_id = p.id
        LEFT JOIN programs pg ON pg.id = p.program_id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        LEFT JOIN (
            SELECT indicator_id, COALESCE(SUM(cost), 0)::float AS activity_spent
            FROM activities
            GROUP BY indicator_id
        ) a ON a.indicator_id = i.id
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
    const rows = await query;
    return rows.map((row) => {
        const score = calculateRisk(row);
        return {
            ...row,
            auto_risk_score: score,
            risk_level: riskLevel(score),
        };
    });
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
        const reportType = query.type || 'me_monthly';

        if (path.includes('/reports/pdf')) {
            return {
                statusCode: 200,
                headers: {
                    ...baseHeaders,
                    'Content-Type': 'text/html; charset=utf-8',
                },
                body: buildHtmlReport(rows, reportType),
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
