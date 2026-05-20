import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    ensureAnyPermission,
    canSeeOrganizationIndicators,
} from './utils/rbac.js';

const hasTable = async (tableName) => {
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

const indicatorScopeFilter = (actor, alias = 'i') => {
    if (canSeeOrganizationIndicators(actor)) return '';
    const actorId = Number(actor.id);
    return `
        AND (
            ${alias}.created_by_user_id = ${actorId}
            OR EXISTS (
                SELECT 1
                FROM project_assignments pa
                WHERE pa.project_id = ${alias}.project_id
                  AND pa.user_id = ${actorId}
                  AND pa.is_active = TRUE
            )
        )
    `;
};

const compassIndicatorScopeFilter = (actor, alias = 'mis') => {
    if (canSeeOrganizationIndicators(actor)) return '';
    const actorId = Number(actor.id);
    const actorEmail = String(actor.email || '').replace(/'/g, "''");
    return `
        AND (
            ${alias}.payload #>> '{submittedBy,email}' = '${actorEmail}'
            OR EXISTS (
                SELECT 1
                FROM project_assignments pa
                WHERE pa.project_id = ${alias}.erp_project_id
                  AND pa.user_id = ${actorId}
                  AND pa.is_active = TRUE
            )
        )
    `;
};

const compassActivityScopeFilter = (actor, alias = 'mas') => {
    if (canSeeOrganizationIndicators(actor)) return '';
    const actorId = Number(actor.id);
    const actorEmail = String(actor.email || '').replace(/'/g, "''");
    return `
        AND (
            ${alias}.payload #>> '{submittedBy,email}' = '${actorEmail}'
            OR ${alias}.payload #>> '{facilitatorEmail}' = '${actorEmail}'
            OR EXISTS (
                SELECT 1
                FROM project_assignments pa
                WHERE pa.project_id = ${alias}.erp_project_id
                  AND pa.user_id = ${actorId}
                  AND pa.is_active = TRUE
            )
        )
    `;
};

const formatCompassActivity = (row) => {
    const payload = row.payload || {};
    const submittedBy = payload.submittedBy || {};

    return {
        id: `compass:${row.me_activity_id}`,
        me_activity_id: row.me_activity_id,
        code: row.code,
        erp_field_activity_id: String(row.code || '').startsWith('ERP-')
            ? String(row.code).slice(4)
            : null,
        source_system: 'Compass M&E',
        facilitator_name: submittedBy.name || 'Compass field user',
        reviewer_name: 'Compass M&E',
        project_id: row.erp_project_id,
        project_name: row.project_name || 'Compass synced activity',
        indicator_title: payload.indicator?.title || row.me_indicator_id || null,
        activity_date: row.activity_date,
        location: row.district_name || row.district_code || 'Compass district',
        description: row.name || row.code || 'Compass field activity',
        status: String(row.status || 'submitted').toLowerCase(),
        qa_status: row.qa_status,
        sync_status: 'synced',
        male_count: Number(row.male_participants || 0),
        female_count: Number(row.female_participants || 0),
        total_participants: Number(row.total_participants || 0),
        evidence_count: Number(row.evidence_count || 0),
        logsheet_count: Number(row.logsheet_count || 0),
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_synced_at: row.last_synced_at,
        isCompassSynced: true,
        raw_payload: payload,
    };
};

const formatCompassIndicator = (row) => {
    const target = Number(row.target_value || 0);
    const reached = Number(row.reached_value || 0);
    const payload = row.payload || {};

    return {
        id: `compass:${row.me_indicator_id}`,
        me_indicator_id: row.me_indicator_id,
        source_system: 'Compass M&E',
        code: row.code,
        title: row.title || row.code || 'Compass indicator',
        project_id: row.erp_project_id,
        project_name: row.project_name || null,
        target_value: target,
        current_value: reached,
        total_budget: 0,
        current_budget_balance: 0,
        priority: payload.priority || 'medium',
        status: String(row.status || 'active').toLowerCase(),
        reporting_period_start: null,
        reporting_period_end: null,
        last_updated: row.last_synced_at,
        created_at: row.created_at,
        owner_name: 'Compass M&E',
        approved_activity_count: Number(row.approved_activity_count || 0),
        participant_total: Number(row.participant_total || 0),
        progress_percentage: target > 0 ? Math.round((reached / target) * 100) : 0,
        budget_utilization_percent: 0,
        risk_level: reached < target * 0.5 ? 'medium' : 'low',
        sync_status: 'synced',
    };
};

const loadCompassIndicators = async (actor) => {
    if (!(await hasTable('me_indicator_summaries'))) return [];

    const rows = await sql.unsafe(`
        SELECT
            mis.*,
            p.name AS project_name
        FROM me_indicator_summaries mis
        LEFT JOIN projects p ON p.id = mis.erp_project_id
        WHERE 1=1
        ${compassIndicatorScopeFilter(actor, 'mis')}
        ORDER BY mis.last_synced_at DESC, mis.title ASC
    `);

    return rows.map(formatCompassIndicator);
};

const loadCompassActivities = async (actor) => {
    if (!(await hasTable('me_activity_summaries'))) return [];

    const rows = await sql.unsafe(`
        SELECT
            mas.*,
            p.name AS project_name
        FROM me_activity_summaries mas
        LEFT JOIN projects p ON p.id = mas.erp_project_id
        WHERE 1=1
        ${compassActivityScopeFilter(actor, 'mas')}
        ORDER BY mas.activity_date DESC NULLS LAST, mas.last_synced_at DESC
        LIMIT 200
    `);

    return rows.map(formatCompassActivity);
};

const loadCompassPerformance = async (actor) => {
    if (!(await hasTable('me_activity_summaries'))) return [];

    return sql.unsafe(`
        SELECT
            TO_CHAR(DATE_TRUNC('month', activity_date), 'YYYY-MM') AS reporting_period,
            SUM(total_participants)::int AS total_reached,
            0::int AS total_target
        FROM me_activity_summaries mas
        WHERE activity_date IS NOT NULL
        ${compassActivityScopeFilter(actor, 'mas')}
        GROUP BY DATE_TRUNC('month', activity_date)
        ORDER BY DATE_TRUNC('month', activity_date) DESC
        LIMIT 6
    `);
};

const ensureIndicatorAccess = async (actor, indicatorId) => {
    if (canSeeOrganizationIndicators(actor)) return;
    const rows = await sql`
        SELECT i.id
        FROM indicators i
        LEFT JOIN project_assignments pa
          ON pa.project_id = i.project_id
         AND pa.user_id = ${actor.id}
         AND pa.is_active = TRUE
        WHERE i.id = ${indicatorId}
          AND (i.created_by_user_id = ${actor.id} OR pa.id IS NOT NULL)
        LIMIT 1
    `;
    if (rows.length === 0) {
        throw new HttpError('Permission denied', 403);
    }
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            ensureAnyPermission(actor, ['indicator.read_all', 'indicator.read_assigned', 'project.read'], {
                allowPending: true,
            });
            const { indicator_id, period } = query;

            if (event.path.includes('/compass-indicators')) {
                return successResponse(await loadCompassIndicators(actor));
            }

            if (event.path.includes('/compass-activities')) {
                return successResponse(await loadCompassActivities(actor));
            }

            // 1. If dashboard summary requested
            if (event.path.includes('/summary')) {
                const compassPerformance = await loadCompassPerformance(actor);
                if (!(await hasTable('indicator_progress')) || !(await hasTable('indicator_targets'))) {
                    return successResponse(compassPerformance);
                }
                const performance = await sql.unsafe(`
                    SELECT 
                        reporting_period,
                        SUM(value) as total_reached,
                        (
                            SELECT SUM(it.target_value)
                            FROM indicator_targets it
                            JOIN indicators ti ON ti.id = it.indicator_id
                            WHERE it.reporting_period = ip.reporting_period
                            ${indicatorScopeFilter(actor, 'ti')}
                        ) as total_target
                    FROM indicator_progress ip
                    JOIN indicators i ON i.id = ip.indicator_id
                    WHERE ip.status = 'approved'
                    ${indicatorScopeFilter(actor, 'i')}
                    GROUP BY reporting_period
                    ORDER BY reporting_period DESC
                    LIMIT 6
                `);
                return successResponse(performance.length > 0 ? performance : compassPerformance);
            }

            // 2. detailed progress for an indicator
            if (indicator_id) {
                if (!(await hasTable('indicator_targets')) || !(await hasTable('indicator_progress'))) {
                    return successResponse({ targets: [], progress: [] });
                }
                await ensureIndicatorAccess(actor, indicator_id);
                const targets = await sql`
                    SELECT * FROM indicator_targets 
                    WHERE indicator_id = ${indicator_id} 
                    ORDER BY reporting_period ASC
                `;
                const progress = await sql`
                    SELECT * FROM indicator_progress 
                    WHERE indicator_id = ${indicator_id} 
                    ORDER BY created_at DESC
                `;
                return successResponse({ targets, progress });
            }

            return errorResponse('Missing parameters', 400);
        }

        if (method === 'POST') {
            ensurePermission(actor, 'indicator.update');
            const { indicator_id, reporting_period, value, notes } = body;

            if (!indicator_id || !reporting_period || value === undefined) {
                return errorResponse('indicator_id, reporting_period, and value are required', 400);
            }
            await ensureIndicatorAccess(actor, indicator_id);

            const result = await sql.begin(async (tx) => {
                // Find or create target
                let target = await tx`
                    SELECT id FROM indicator_targets 
                    WHERE indicator_id = ${indicator_id} AND reporting_period = ${reporting_period}
                `;

                if (target.length === 0) {
                    target = await tx`
                        INSERT INTO indicator_targets (indicator_id, reporting_period, target_value)
                        VALUES (${indicator_id}, ${reporting_period}, 0)
                        RETURNING id
                    `;
                }

                const ip = await tx`
                    INSERT INTO indicator_progress (indicator_id, target_id, reporting_period, value, notes, reported_by_user_id)
                    VALUES (${indicator_id}, ${target[0].id}, ${reporting_period}, ${value}, ${notes || null}, ${actor.id})
                    RETURNING *
                `;

                // Update the main indicator current_value (additive)
                await tx`
                    UPDATE indicators 
                    SET current_value = current_value + ${value}, last_updated = CURRENT_TIMESTAMP
                    WHERE id = ${indicator_id}
                `;

                return ip[0];
            });

            return successResponse({ message: 'Progress reported successfully', progress: result });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('ME function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
