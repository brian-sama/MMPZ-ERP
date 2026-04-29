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
import { createNotifications } from './utils/notification-center.js';
import {
    writeBase64Upload,
    DOCUMENT_MIME_TYPES,
    IMAGE_MIME_TYPES,
    readUploadedFileAsDataUrl,
    removeUploadedFile,
} from './utils/uploads.js';
import postgres from 'postgres';

const VOLUNTEER_UPLOAD_MIME_TYPES = [...DOCUMENT_MIME_TYPES, ...IMAGE_MIME_TYPES];
const EXCEL_MIME_TYPES = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const LEAVE_APPLICATION_ROLES = new Set([
    'DIRECTOR',
    'SYSTEM_ADMIN',
    'FINANCE_ADMIN_OFFICER',
    'ADMIN_ASSISTANT',
    'LOGISTICS_ASSISTANT',
    'PSYCHOSOCIAL_SUPPORT_OFFICER',
    'COMMUNITY_DEVELOPMENT_OFFICER',
    'ME_INTERN_ACTING_OFFICER',
    'SOCIAL_SERVICES_INTERN',
    'YOUTH_COMMUNICATIONS_INTERN',
]);
const REQUEST_FOR_FUNDS_ROLES = new Set([
    'SYSTEM_ADMIN',
    'FINANCE_ADMIN_OFFICER',
    'ADMIN_ASSISTANT',
    'LOGISTICS_ASSISTANT',
    'PSYCHOSOCIAL_SUPPORT_OFFICER',
    'COMMUNITY_DEVELOPMENT_OFFICER',
    'ME_INTERN_ACTING_OFFICER',
    'SOCIAL_SERVICES_INTERN',
    'YOUTH_COMMUNICATIONS_INTERN',
]);

const getVolunteerSubmissionColumns = async () => {
    const rows = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'volunteer_submissions'
    `;
    return new Set(rows.map((row) => row.column_name));
};

const hasVolunteerRecipientTable = async () => {
    const rows = await sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'volunteer_submission_recipients'
        ) AS exists
    `;
    return Boolean(rows[0]?.exists);
};

const hasKoboFormLinksTable = async () => {
    const rows = await sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'kobo_form_links'
        ) AS exists
    `;
    return Boolean(rows[0]?.exists);
};

const buildVolunteerSubmissionSelect = (columns, recipientTableExists, actorId) => {
    const has = (column) => columns.has(column);
    const value = (column, fallback) =>
        has(column)
            ? `s.${column}`
            : fallback;
    const assignedExpr = recipientTableExists
        ? `EXISTS (
            SELECT 1
            FROM volunteer_submission_recipients vsr
            WHERE vsr.submission_id = s.id
              AND vsr.user_id = ${Number(actorId) || 0}
        )`
        : 'FALSE';

    return postgres.unsafe(`
        s.id,
        s.user_id,
        u.name AS volunteer_name,
        ${value('type', "''::text")} AS type,
        ${value('assignment_id', 'NULL::int')} AS assignment_id,
        ${value('project_id', 'NULL::int')} AS project_id,
        p.name AS project_name,
        ${value('title', 'NULL::text')} AS title,
        ${value('content', 'NULL::text')} AS content,
        ${value('file_path', 'NULL::text')} AS file_path,
        ${value('file_name', 'NULL::text')} AS file_name,
        ${value('mime_type', 'NULL::text')} AS mime_type,
        ${value('description', 'NULL::text')} AS description,
        ${value('created_at', 'CURRENT_TIMESTAMP')} AS created_at,
        (${has('file_data') ? 'COALESCE(LENGTH(s.file_data), 0) > 0' : 'FALSE'} OR ${has('file_path') ? 's.file_path IS NOT NULL' : 'FALSE'}) AS has_file,
        ${assignedExpr} AS assigned_to_actor
    `);
};

const normalizeRecipientIds = (input) =>
    [...new Set((Array.isArray(input) ? input : [])
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0))];

const normalizeUploadType = (value) => String(value || '').trim().toLowerCase();

const isExcelUpload = (mimeType, fileName) =>
    EXCEL_MIME_TYPES.includes(String(mimeType || '').toLowerCase()) ||
    /\.(xlsx|xls)$/i.test(String(fileName || ''));

const loadRecipientsByRoles = async (tx, roleCodes) => {
    if (!Array.isArray(roleCodes) || roleCodes.length === 0) return [];
    return tx`
        SELECT id, name, role_code
        FROM users
        WHERE role_code = ANY(${roleCodes})
    `;
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    const path = event.path.replace('/api/volunteer/', '');
    const method = event.httpMethod;

    try {
        const body = parseBody(event);
        const actor = await getUserContext(getRequestUserId(event, body));

        if (path.startsWith('submit') && method === 'POST') {
            ensurePermission(actor, 'volunteer.submit');

            const {
                type,
                fileData,
                fileName,
                mimeType,
                description,
                title,
                content,
                assignment_id,
                assignmentId,
                project_id,
                projectId,
                recipients,
                assigned_user_ids,
            } = body;

            const normalizedType = normalizeUploadType(type);

            if (!normalizedType) return errorResponse('Submission type is required', 400);
            if (!fileData && !content && !description) {
                return errorResponse('Provide narrative content, a file attachment, or a description', 400);
            }
            if (normalizedType === 'leave_application' && !LEAVE_APPLICATION_ROLES.has(actor.role_code)) {
                return errorResponse('Only internal staff members can upload leave application forms.', 403);
            }
            if (normalizedType === 'request_for_funds_plan' && !REQUEST_FOR_FUNDS_ROLES.has(actor.role_code)) {
                return errorResponse('Only officers and graduate trainees can upload request-for-funds plans.', 403);
            }
            if ((normalizedType === 'leave_application' || normalizedType === 'request_for_funds_plan') && !fileData) {
                return errorResponse('This submission type requires a file attachment.', 400);
            }
            if (normalizedType === 'request_for_funds_plan' && !isExcelUpload(mimeType, fileName)) {
                return errorResponse('Request-for-funds plans must be uploaded as an Excel file (.xls or .xlsx).', 400);
            }

            let uploadedFile = null;
            if (fileData) {
                uploadedFile = writeBase64Upload({
                    base64Data: fileData,
                    fileName,
                    mimeType,
                    subdirectory: 'volunteer-submissions',
                    prefix: normalizedType,
                    allowedMimeTypes: VOLUNTEER_UPLOAD_MIME_TYPES,
                    maxBytes: 8 * 1024 * 1024,
                });
            }

            const recipientIds = normalizeRecipientIds(recipients || assigned_user_ids || []);

            try {
                const result = await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    const rows = await tx`
                        INSERT INTO volunteer_submissions (
                            user_id,
                            type,
                            assignment_id,
                            project_id,
                            title,
                            content,
                            file_data,
                            file_path,
                            file_name,
                            mime_type,
                            description
                        )
                        VALUES (
                            ${actor.id},
                            ${normalizedType},
                            ${assignment_id || assignmentId || null},
                            ${project_id || projectId || null},
                            ${title || null},
                            ${content || null},
                            ${null},
                            ${uploadedFile?.publicPath || null},
                            ${fileName || uploadedFile?.fileName || null},
                            ${mimeType || uploadedFile?.mimeType || null},
                            ${description || null}
                        )
                        RETURNING id, type, title, file_name, file_path, created_at
                    `;

                    const submission = rows[0];
                    const targetedRecipients = [];
                    const addRecipients = (users) => {
                        for (const user of users || []) {
                            if (!targetedRecipients.some((recipient) => recipient.id === user.id)) {
                                targetedRecipients.push(user);
                            }
                        }
                    };

                    if (recipientIds.length > 0) {
                        const candidates = await tx`
                            SELECT id, name, role_code
                            FROM users
                            WHERE role_code <> 'DEVELOPMENT_FACILITATOR'
                        `;
                        addRecipients(candidates.filter((user) => recipientIds.includes(user.id)));
                    }

                    if (normalizedType === 'leave_application') {
                        addRecipients(
                            await loadRecipientsByRoles(tx, ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'LOGISTICS_ASSISTANT'])
                        );
                    }

                    if (normalizedType === 'request_for_funds_plan') {
                        addRecipients(await loadRecipientsByRoles(tx, ['DIRECTOR']));
                    }

                    if (targetedRecipients.length > 0) {
                        for (const recipient of targetedRecipients) {
                            await tx`
                                INSERT INTO volunteer_submission_recipients (
                                    submission_id,
                                    user_id,
                                    assigned_by_user_id
                                )
                                VALUES (
                                    ${submission.id},
                                    ${recipient.id},
                                    ${actor.id}
                                )
                                ON CONFLICT (submission_id, user_id) DO NOTHING
                            `;
                        }

                        await createNotifications(
                            tx,
                            targetedRecipients.map((recipient) => ({
                                userId: recipient.id,
                                type: 'system',
                                title:
                                    normalizedType === 'leave_application'
                                        ? 'New leave application submitted'
                                        : normalizedType === 'request_for_funds_plan'
                                            ? 'Request-for-funds plan awaiting review'
                                            : 'New facilitator report assigned',
                                message:
                                    normalizedType === 'leave_application'
                                        ? `${actor.name} submitted a leave application for review.`
                                        : normalizedType === 'request_for_funds_plan'
                                            ? `${actor.name} submitted a request-for-funds plan that needs director approval.`
                                            : `${actor.name} assigned "${title || fileName || 'a field report'}" to you for review.`,
                                relatedEntityType: 'volunteer_submission',
                                relatedEntityId: String(submission.id),
                                actionUrl:
                                    normalizedType === 'leave_application' || normalizedType === 'request_for_funds_plan'
                                        ? `/reports?submission=${submission.id}`
                                        : '/my-portal',
                            }))
                        );
                    }

                    if (normalizedType === 'request_for_funds_plan') {
                        await tx`
                            INSERT INTO approvals (
                                entity_type,
                                entity_id,
                                requested_by_user_id,
                                status,
                                current_step,
                                amount,
                                notes
                            )
                            VALUES (
                                'volunteer_submission',
                                ${String(submission.id)},
                                ${actor.id},
                                'pending',
                                1,
                                NULL,
                                ${description || title || fileName || 'Request-for-funds plan'}
                            )
                        `;
                    }

                    return submission;
                });

                return successResponse({ message: 'Submission successful', submission: result });
            } catch (dbError) {
                if (uploadedFile?.publicPath) {
                    removeUploadedFile(uploadedFile.publicPath);
                }
                throw dbError;
            }
        }

        if (path.startsWith('submissions') && method === 'GET') {
            const submissionId = path.split('/')[1] || null;
            let result;
            const submissionColumns = await getVolunteerSubmissionColumns();
            const recipientTableExists = await hasVolunteerRecipientTable();
            const baseSelectColumns = buildVolunteerSubmissionSelect(
                submissionColumns,
                recipientTableExists,
                actor.id
            );

            const baseSelect = sql`
                SELECT
                    ${baseSelectColumns}
                FROM volunteer_submissions s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN projects p ON s.project_id = p.id
            `;

            if (submissionId) {
                const detail = hasPermission(actor, 'volunteer.read_all')
                    ? await sql`
                        ${baseSelect}
                        WHERE s.id = ${submissionId}
                        LIMIT 1
                    `
                    : await sql`
                        ${baseSelect}
                        WHERE s.id = ${submissionId}
                          AND (
                              s.user_id = ${actor.id}
                              OR ${recipientTableExists ? sql`EXISTS (
                                  SELECT 1
                                  FROM volunteer_submission_recipients vsr
                                  WHERE vsr.submission_id = s.id
                                    AND vsr.user_id = ${actor.id}
                              )` : sql`FALSE`}
                          )
                        LIMIT 1
                    `;

                if (detail.length === 0) return errorResponse('Submission not found', 404);
                return successResponse(detail[0]);
            }

            if (hasPermission(actor, 'volunteer.read_all')) {
                result = await sql`
                    ${baseSelect}
                    ORDER BY s.created_at DESC
                `;
            } else {
                result = await sql`
                    ${baseSelect}
                    WHERE s.user_id = ${actor.id}
                       OR ${recipientTableExists ? sql`EXISTS (
                            SELECT 1
                            FROM volunteer_submission_recipients vsr
                            WHERE vsr.submission_id = s.id
                              AND vsr.user_id = ${actor.id}
                       )` : sql`FALSE`}
                    ORDER BY s.created_at DESC
                `;
            }

            return successResponse(result);
        }

        if (path.startsWith('download/') && method === 'GET') {
            const id = path.split('/')[1];
            if (!id) return errorResponse('File ID is required', 400);

            const rows = await sql`
                SELECT id, user_id, file_data, file_path, file_name, mime_type
                FROM volunteer_submissions
                WHERE id = ${id}
                LIMIT 1
            `;
            if (rows.length === 0) return errorResponse('File not found', 404);

            const file = rows[0];
            if (!hasPermission(actor, 'volunteer.read_all') && file.user_id !== actor.id) {
                const assigned = await sql`
                    SELECT id
                    FROM volunteer_submission_recipients
                    WHERE submission_id = ${id}
                      AND user_id = ${actor.id}
                    LIMIT 1
                `;
                if (assigned.length === 0) {
                    return errorResponse('Unauthorized', 403);
                }
            }
            if (!file.file_data && !file.file_path) {
                return errorResponse('File is no longer available', 404);
            }
            return successResponse({
                ...file,
                file_data:
                    file.file_data ||
                    readUploadedFileAsDataUrl(file.file_path, file.mime_type || 'application/octet-stream'),
            });
        }

        if (path.startsWith('activity-report') && method === 'POST') {
            ensurePermission(actor, 'volunteer.submit');

            const indicatorId = body.indicatorId || body.indicator_id;
            const male = body.male || body.male_count;
            const female = body.female || body.female_count;
            const notes = body.notes || null;
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
                if (!(await hasKoboFormLinksTable())) {
                    return errorResponse(
                        'KoBo request storage is not available until the latest database migrations are applied.',
                        503
                    );
                }
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
                if (!(await hasKoboFormLinksTable())) {
                    return successResponse([]);
                }
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
