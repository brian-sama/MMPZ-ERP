import { sql } from './utils/db.js';
import {
    successResponse,
    errorResponse,
    corsResponse,
    parseBody,
    getQueryParams,
    getPathParam,
} from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    setAuditActor,
} from './utils/rbac.js';
import {
    writeBase64Upload,
    removeUploadedFile,
    DOCUMENT_MIME_TYPES,
} from './utils/uploads.js';

const assertDocumentMutationAllowed = (actor) => {
    if (actor.role_code === 'DEVELOPMENT_FACILITATOR') {
        throw new HttpError('Development facilitators cannot manage the shared document library.', 403);
    }
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const id = getPathParam(event, 'id') || getPathParam(event, 'documents');
        const actor = await getUserContext(getRequestUserId(event, body));

        if (method === 'GET') {
            const category = query.category || null;

            if (id) {
                const rows = await sql`
                    SELECT
                        d.*,
                        u.name AS uploaded_by_name
                    FROM document_library_files d
                    LEFT JOIN users u ON d.uploaded_by_user_id = u.id
                    WHERE d.id = ${id}
                    LIMIT 1
                `;
                if (rows.length === 0) return errorResponse('Document not found', 404);
                return successResponse(rows[0]);
            }

            let rows;
            if (category && category !== 'All') {
                rows = await sql`
                    SELECT
                        d.*,
                        u.name AS uploaded_by_name
                    FROM document_library_files d
                    LEFT JOIN users u ON d.uploaded_by_user_id = u.id
                    WHERE d.category = ${category}
                    ORDER BY d.created_at DESC
                `;
            } else {
                rows = await sql`
                    SELECT
                        d.*,
                        u.name AS uploaded_by_name
                    FROM document_library_files d
                    LEFT JOIN users u ON d.uploaded_by_user_id = u.id
                    ORDER BY d.created_at DESC
                `;
            }

            const categories = await sql`
                SELECT DISTINCT category
                FROM document_library_files
                ORDER BY category ASC
            `;

            return successResponse({
                items: rows,
                categories: categories.map((row) => row.category),
            });
        }

        if (method === 'POST') {
            assertDocumentMutationAllowed(actor);

            if (!body.title || !body.fileData || !body.fileName) {
                return errorResponse('title, fileData and fileName are required', 400);
            }

            const uploadedFile = writeBase64Upload({
                base64Data: body.fileData,
                fileName: body.fileName,
                mimeType: body.mimeType,
                subdirectory: 'documents',
                prefix: 'library',
                allowedMimeTypes: DOCUMENT_MIME_TYPES,
                maxBytes: 8 * 1024 * 1024,
            });

            try {
                const inserted = await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    const rows = await tx`
                        INSERT INTO document_library_files (
                            title,
                            file_name,
                            file_path,
                            mime_type,
                            category,
                            description,
                            uploaded_by_user_id,
                            updated_at
                        )
                        VALUES (
                            ${body.title},
                            ${body.fileName},
                            ${uploadedFile.publicPath},
                            ${uploadedFile.mimeType},
                            ${body.category || 'General'},
                            ${body.description || null},
                            ${actor.id},
                            CURRENT_TIMESTAMP
                        )
                        RETURNING *
                    `;
                    return rows[0];
                });

                return successResponse({
                    message: 'Document uploaded successfully',
                    document: inserted,
                });
            } catch (dbError) {
                removeUploadedFile(uploadedFile.publicPath);
                throw dbError;
            }
        }

        if (method === 'DELETE') {
            assertDocumentMutationAllowed(actor);
            if (!id) return errorResponse('Document ID is required', 400);

            const rows = await sql`
                SELECT file_path
                FROM document_library_files
                WHERE id = ${id}
                LIMIT 1
            `;
            if (rows.length === 0) return errorResponse('Document not found', 404);

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`DELETE FROM document_library_files WHERE id = ${id}`;
            });
            removeUploadedFile(rows[0].file_path);

            return successResponse({ message: 'Document removed successfully' });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Document library API error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
