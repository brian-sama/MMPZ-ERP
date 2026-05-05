import { sql } from './utils/db.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
} from './utils/rbac.js';
import { successResponse, errorResponse } from './utils/response.js';

export const handler = async (event) => {
    const method = event.httpMethod;
    const path = event.path;
    const query = event.queryStringParameters || {};

    try {
        const userId = getRequestUserId(event);
        const userContext = await getUserContext(userId);

        // POST /api/activities - Create a new activity (as draft)
        if (method === 'POST' && path === '/api/activities') {
            const body = JSON.parse(event.body || '{}');
            const {
                project_id,
                indicator_id,
                activity_date,
                location,
                description,
                assigned_reviewer_id,
                plan_submission_id,
            } = body;

            if (!activity_date || !assigned_reviewer_id) {
                throw new HttpError('Activity date and assigned reviewer are required', 400);
            }

            const [activity] = await sql`
                INSERT INTO field_activities (
                    facilitator_id,
                    project_id,
                    indicator_id,
                    activity_date,
                    location,
                    description,
                    assigned_reviewer_id,
                    plan_submission_id,
                    status
                ) VALUES (
                    ${userId},
                    ${project_id},
                    ${indicator_id},
                    ${activity_date},
                    ${location},
                    ${description},
                    ${assigned_reviewer_id},
                    ${plan_submission_id},
                    'draft'
                ) RETURNING *
            `;

            return successResponse(activity, 201);
        }

        // GET /api/activities - List activities
        if (method === 'GET' && path === '/api/activities') {
            const limit = parseInt(query.limit) || 50;
            const offset = parseInt(query.offset) || 0;
            const status = query.status;

            let results;
            if (userContext.role_code === 'DEVELOPMENT_FACILITATOR') {
                results = await sql`
                    SELECT a.*, u.name as reviewer_name, p.name as project_name, i.title as indicator_title
                    FROM field_activities a
                    LEFT JOIN users u ON a.assigned_reviewer_id = u.id
                    LEFT JOIN projects p ON a.project_id = p.id
                    LEFT JOIN indicators i ON a.indicator_id = i.id
                    WHERE a.facilitator_id = ${userId}
                      AND (${status}::text IS NULL OR a.status = ${status})
                    ORDER BY a.activity_date DESC
                    LIMIT ${limit} OFFSET ${offset}
                `;
            } else {
                // Officer/Intern/Director view: see assigned or all if Director
                results = await sql`
                    SELECT a.*, f.name as facilitator_name, p.name as project_name, i.title as indicator_title
                    FROM field_activities a
                    JOIN users f ON a.facilitator_id = f.id
                    LEFT JOIN projects p ON a.project_id = p.id
                    LEFT JOIN indicators i ON a.indicator_id = i.id
                    WHERE (a.assigned_reviewer_id = ${userId} OR ${userContext.role_code} IN ('DIRECTOR', 'SYSTEM_ADMIN'))
                      AND (${status}::text IS NULL OR a.status = ${status})
                    ORDER BY a.activity_date DESC
                    LIMIT ${limit} OFFSET ${offset}
                `;
            }

            return successResponse(results);
        }

        // GET /api/activities/:id - Get detail
        const detailMatch = path.match(/\/api\/activities\/([^\/]+)$/);
        if (method === 'GET' && detailMatch) {
            const activityId = detailMatch[1];
            const [activity] = await sql`
                SELECT a.*, f.name as facilitator_name, u.name as reviewer_name, p.name as project_name, i.title as indicator_title
                FROM field_activities a
                JOIN users f ON a.facilitator_id = f.id
                LEFT JOIN users u ON a.assigned_reviewer_id = u.id
                LEFT JOIN projects p ON a.project_id = p.id
                LEFT JOIN indicators i ON a.indicator_id = i.id
                WHERE a.id = ${activityId}
                LIMIT 1
            `;
            if (!activity) throw new HttpError('Activity not found', 404);

            // Fetch linked data (participants/reports)
            const reports = await sql`
                SELECT * FROM volunteer_activity_reports WHERE field_activity_id = ${activityId}
            `;
            const evidence = await sql`
                SELECT * FROM volunteer_submissions WHERE field_activity_id = ${activityId}
            `;

            return successResponse({ ...activity, reports, evidence });
        }

        // PUT /api/activities/:id - Update activity
        if (method === 'PUT' && detailMatch) {
            const activityId = detailMatch[1];
            const body = JSON.parse(event.body || '{}');
            const { description, location, male_count, female_count, notes } = body;

            // Update main activity record
            const [activity] = await sql`
                UPDATE field_activities
                SET description = COALESCE(${description}, description),
                    location = COALESCE(${location}, location),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${activityId} AND facilitator_id = ${userId} AND status = 'draft'
                RETURNING *
            `;
            if (!activity) throw new HttpError('Activity not found or not in draft status', 404);

            // Update or create participant report
            if (male_count !== undefined || female_count !== undefined) {
                const [existingReport] = await sql`SELECT id FROM volunteer_activity_reports WHERE field_activity_id = ${activityId} LIMIT 1`;
                if (existingReport) {
                    await sql`
                        UPDATE volunteer_activity_reports
                        SET male_count = COALESCE(${male_count}, male_count),
                            female_count = COALESCE(${female_count}, female_count),
                            notes = COALESCE(${notes}, notes)
                        WHERE id = ${existingReport.id}
                    `;
                } else if (activity.indicator_id) {
                    await sql`
                        INSERT INTO volunteer_activity_reports (user_id, indicator_id, field_activity_id, male_count, female_count, notes)
                        VALUES (${userId}, ${activity.indicator_id}, ${activityId}, ${male_count || 0}, ${female_count || 0}, ${notes})
                    `;
                }
            }

            return successResponse(activity);
        }

        // POST /api/activities/:id/submit - Submit for review
        const submitMatch = path.match(/\/api\/activities\/([^\/]+)\/submit$/);
        if (method === 'POST' && submitMatch) {
            const activityId = submitMatch[1];
            
            const [activity] = await sql`
                SELECT * FROM field_activities WHERE id = ${activityId} AND facilitator_id = ${userId} LIMIT 1
            `;
            if (!activity) throw new HttpError('Activity not found', 404);
            if (activity.status !== 'draft') throw new HttpError('Activity is already submitted', 400);

            // Create a unified submission record
            const [submission] = await sql`
                INSERT INTO unified_submissions (
                    submitter_user_id,
                    submission_type,
                    department_category,
                    title,
                    description,
                    current_handler_user_id,
                    status,
                    related_entity_type,
                    related_entity_id
                ) VALUES (
                    ${userId},
                    'field_activity',
                    'PROGRAM',
                    ${'Field Activity: ' + (activity.description ? activity.description.substring(0, 50) : activityId)},
                    ${activity.description},
                    ${activity.assigned_reviewer_id},
                    'submitted',
                    'field_activity',
                    ${activityId}
                ) RETURNING *
            `;

            // Update activity status
            await sql`
                UPDATE field_activities
                SET status = 'submitted', updated_at = CURRENT_TIMESTAMP
                WHERE id = ${activityId}
            `;

            // Log workflow
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
                    'Submitted for field review'
                )
            `;

            return successResponse({ activityId, submissionId: submission.id });
        }

        throw new HttpError('Route not found', 404);
    } catch (err) {
        return errorResponse(err);
    }
};
