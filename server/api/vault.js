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
    readUploadedFileAsDataUrl,
    DOCUMENT_MIME_TYPES,
} from './utils/uploads.js';

const VAULT_CATEGORY = 'Finance Vault';

const VAULT_ROLES = new Set([
    'DIRECTOR',
    'FINANCE_OFFICER',
    'ADMIN_FINANCE_ASSISTANT',
    'LOGISTICS_FINANCE_ASSISTANT',
    'SYSTEM_ADMIN',
]);

const assertVaultAccess = (actor) => {
    if (actor.system_role === 'SUPER_ADMIN') return;
    if (!VAULT_ROLES.has(actor.role_code)) {
        throw new HttpError(
            'Access to the Finance Vault is restricted to finance and administration roles.',
            403,
        );
    }
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const rawId = getPathParam(event, 'id') || getPathParam(event, 'vault');
        const actor = await getUserContext(getRequestUserId(event, body));

        assertVaultAccess(actor);

        if (method === 'GET') {
            // Download: GET /api/vault/:id/download
            if (rawId && event.path?.endsWith('/download')) {
                const documentId = String(rawId).replace(/\/download$/, '');
                const rows = await sql`
                    SELECT id, title, file_name, file_path, mime_type
                    FROM document_library_files
                    WHERE id = ${documentId}
                      AND category = ${VAULT_CATEGORY}
                    LIMIT 1
                `;
                if (rows.length === 0) return errorResponse('Vault document not found', 404);
                const doc = rows[0];
                const fileData = readUploadedFileAsDataUrl(doc.file_path, doc.mime_type || 'application/octet-stream');
                if (!fileData) return errorResponse('File is no longer available on disk', 404);
                return successResponse({ ...doc, file_data: fileData });
            }

            // Single document
            if (rawId) {
                const rows = await sql`
                    SELECT d.*, u.name AS uploaded_by_name
                    FROM document_library_files d
                    LEFT JOIN users u ON d.uploaded_by_user_id = u.id
                    WHERE d.id = ${rawId}
                      AND d.category = ${VAULT_CATEGORY}
                    LIMIT 1
                `;
                if (rows.length === 0) return errorResponse('Vault document not found', 404);
                return successResponse(rows[0]);
            }

            // List — optional sub-category filter within the vault
            const sub = query.sub_category || null;
            let rows;
            if (sub) {
                rows = await sql`
                    SELECT d.*, u.name AS uploaded_by_name
                    FROM document_library_files d
                    LEFT JOIN users u ON d.uploaded_by_user_id = u.id
                    WHERE d.category = ${VAULT_CATEGORY}
                      AND d.description ILIKE ${'%[' + sub + ']%'}
                    ORDER BY d.created_at DESC
                `;
            } else {
                rows = await sql`
                    SELECT d.*, u.name AS uploaded_by_name
                    FROM document_library_files d
                    LEFT JOIN users u ON d.uploaded_by_user_id = u.id
                    WHERE d.category = ${VAULT_CATEGORY}
                    ORDER BY d.created_at DESC
                `;
            }

            return successResponse({ items: rows, total: rows.length });
        }

        if (method === 'POST') {
            if (!body.title || !body.fileData || !body.fileName) {
                return errorResponse('title, fileData and fileName are required', 400);
            }

            const uploadedFile = writeBase64Upload({
                base64Data: body.fileData,
                fileName: body.fileName,
                mimeType: body.mimeType,
                subdirectory: 'vault',
                prefix: 'vault',
                allowedMimeTypes: DOCUMENT_MIME_TYPES,
                maxBytes: 20 * 1024 * 1024,
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
                            ${VAULT_CATEGORY},
                            ${body.description || null},
                            ${actor.id},
                            CURRENT_TIMESTAMP
                        )
                        RETURNING *
                    `;
                    return rows[0];
                });

                return successResponse({
                    message: 'Document added to vault successfully',
                    document: inserted,
                });
            } catch (dbError) {
                removeUploadedFile(uploadedFile.publicPath);
                throw dbError;
            }
        }

        if (method === 'DELETE') {
            if (!rawId) return errorResponse('Document ID is required', 400);

            const rows = await sql`
                SELECT file_path
                FROM document_library_files
                WHERE id = ${rawId}
                  AND category = ${VAULT_CATEGORY}
                LIMIT 1
            `;
            if (rows.length === 0) return errorResponse('Vault document not found', 404);

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`DELETE FROM document_library_files WHERE id = ${rawId}`;
            });
            removeUploadedFile(rows[0].file_path);

            return successResponse({ message: 'Document removed from vault' });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Finance Vault API error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
