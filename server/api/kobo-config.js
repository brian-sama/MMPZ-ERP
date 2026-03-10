import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import axios from 'axios';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    ensurePermission,
    setAuditActor,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        // GET - Fetch config (read-only)
        if (method === 'GET') {
            ensureAnyPermission(actor, ['kobo.manage', 'kobo.sync', 'approval.read'], {
                allowPending: true,
            });
            const configs = await sql`SELECT * FROM kobo_config LIMIT 1`;
            const data = configs.length > 0 ? configs[0] : null;
            return successResponse(
                data || {
                    server_url: 'https://kf.kobotoolbox.org',
                    api_token: '',
                    is_connected: false,
                }
            );
        }

        // POST - Save config
        if (method === 'POST') {
            ensurePermission(actor, 'kobo.manage');
            const { server_url, api_token } = body;
            if (!server_url || !api_token) {
                return errorResponse('server_url and api_token are required', 400);
            }

            const testRes = await axios.get(`${server_url}/api/v2/assets/`, {
                headers: { Authorization: `Token ${api_token}` },
                timeout: 10000,
            });

            const formsCount = testRes.data.count || 0;

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                const existing = await tx`SELECT id FROM kobo_config LIMIT 1`;
                if (existing.length > 0) {
                    await tx`
                        UPDATE kobo_config
                        SET
                            server_url = ${server_url},
                            api_token = ${api_token},
                            is_connected = TRUE,
                            last_sync = ${new Date().toISOString()}
                        WHERE id = ${existing[0].id}
                    `;
                } else {
                    await tx`
                        INSERT INTO kobo_config (server_url, api_token, is_connected, last_sync)
                        VALUES (${server_url}, ${api_token}, TRUE, ${new Date().toISOString()})
                    `;
                }
            });

            return successResponse({
                success: true,
                forms_count: formsCount,
                message: `Connected successfully! Found ${formsCount} forms.`,
            });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        const detail = error.response?.data?.detail || error.message;
        console.error('Kobo config error:', detail);
        return errorResponse(`Kobo configuration failed: ${detail}`, 500, detail);
    }
};
