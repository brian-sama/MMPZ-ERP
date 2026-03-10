import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    hasPermission,
    setAuditActor,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    const path = event.path.replace('/api/volunteer/', '');
    const method = event.httpMethod;

    try {
        const body = parseBody(event);
        const actor = await getUserContext(getRequestUserId(event, body));

        if (path.startsWith('submit') && method === 'POST') {
            ensurePermission(actor, 'volunteer.submit');

            const { type, fileData, fileName, mimeType, description } = body;
            if (!type || !fileData) return errorResponse('Missing required fields', 400);
            if (fileData.length > 5500000) return errorResponse('File too large (max 4MB)', 413);

            const result = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                const rows = await tx`
                    INSERT INTO volunteer_submissions (
                        user_id,
                        type,
                        file_data,
                        file_name,
                        mime_type,
                        description
                    )
                    VALUES (
                        ${actor.id},
                        ${type},
                        ${fileData},
                        ${fileName || null},
                        ${mimeType || null},
                        ${description || null}
                    )
                    RETURNING id, type, file_name, created_at
                `;
                return rows[0];
            });

            return successResponse({ message: 'Submission successful', submission: result });
        }

        if (path.startsWith('submissions') && method === 'GET') {
            ensurePermission(actor, 'volunteer.read_own', { allowPending: true });
            let result;

            if (hasPermission(actor, 'volunteer.read_all')) {
                result = await sql`
                    SELECT
                        s.id,
                        s.user_id,
                        u.name AS volunteer_name,
                        s.type,
                        s.file_name,
                        s.mime_type,
                        s.description,
                        s.created_at,
                        (LENGTH(s.file_data) > 0) AS has_file
                    FROM volunteer_submissions s
                    JOIN users u ON s.user_id = u.id
                    ORDER BY s.created_at DESC
                `;
            } else {
                result = await sql`
                    SELECT
                        id,
                        user_id,
                        type,
                        file_name,
                        mime_type,
                        description,
                        created_at,
                        (LENGTH(file_data) > 0) AS has_file
                    FROM volunteer_submissions
                    WHERE user_id = ${actor.id}
                    ORDER BY created_at DESC
                `;
            }

            return successResponse(result);
        }

        if (path.startsWith('download/') && method === 'GET') {
            const id = path.split('/')[1];
            if (!id) return errorResponse('File ID is required', 400);
            ensurePermission(actor, 'volunteer.read_own', { allowPending: true });

            const rows = await sql`
                SELECT id, user_id, file_data, file_name, mime_type
                FROM volunteer_submissions
                WHERE id = ${id}
                LIMIT 1
            `;
            if (rows.length === 0) return errorResponse('File not found', 404);

            const file = rows[0];
            if (!hasPermission(actor, 'volunteer.read_all') && file.user_id !== actor.id) {
                return errorResponse('Unauthorized', 403);
            }
            return successResponse(file);
        }

        if (path.startsWith('activity-report') && method === 'POST') {
            ensurePermission(actor, 'volunteer.submit');

            const { indicatorId, male, female, notes } = body;
            if (!indicatorId) return errorResponse('indicatorId is required', 400);

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`
                    INSERT INTO volunteer_activity_reports (
                        user_id,
                        indicator_id,
                        male_count,
                        female_count,
                        notes
                    )
                    VALUES (
                        ${actor.id},
                        ${indicatorId},
                        ${male || 0},
                        ${female || 0},
                        ${notes || null}
                    )
                `;
            });

            return successResponse({ message: 'Activity report saved' });
        }

        if (path.startsWith('kobo-request')) {
            if (method === 'POST') {
                ensurePermission(actor, 'volunteer.submit');
                const { formUid, formName, indicatorId } = body;
                if (!formUid || !indicatorId) return errorResponse('formUid and indicatorId are required', 400);

                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`
                        INSERT INTO kobo_form_links (
                            kobo_form_uid,
                            kobo_form_name,
                            indicator_id,
                            requested_by,
                            status
                        )
                        VALUES (
                            ${formUid},
                            ${formName || null},
                            ${indicatorId},
                            ${actor.id},
                            'pending'
                        )
                    `;
                });
                return successResponse({ message: 'Request submitted' });
            }

            if (method === 'GET') {
                ensurePermission(actor, 'volunteer.read_own', { allowPending: true });
                const requests = await sql`
                    SELECT
                        kfl.*,
                        i.title AS indicator_title
                    FROM kobo_form_links kfl
                    LEFT JOIN indicators i ON kfl.indicator_id = i.id
                    WHERE kfl.requested_by = ${actor.id}
                    ORDER BY kfl.id DESC
                `;
                return successResponse(requests);
            }
        }

        if (path.startsWith('participants') && method === 'GET') {
            ensurePermission(actor, 'volunteer.read_own', { allowPending: true });

            if (hasPermission(actor, 'volunteer.read_all')) {
                const all = await sql`
                    SELECT
                        p.*,
                        u.name AS volunteer_name
                    FROM volunteer_participants p
                    JOIN users u ON p.user_id = u.id
                    ORDER BY p.created_at DESC
                `;
                return successResponse(all);
            }

            const own = await sql`
                SELECT *
                FROM volunteer_participants
                WHERE user_id = ${actor.id}
                ORDER BY created_at DESC
            `;
            return successResponse(own);
        }

        return errorResponse('Not found', 404);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Volunteer API error:', error);
        return errorResponse('Internal error', 500, error.message);
    }
};
