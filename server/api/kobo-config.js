import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    ensurePermission,
} from './utils/rbac.js';

const compassApiBaseUrl = () => {
    const configured = (
        process.env.ME_INTERNAL_API_URL ||
        process.env.COMPASS_INTERNAL_API_URL ||
        'https://monitoring.mmpzmne.co.zw/api'
    ).replace(/\/+$/, '');
    return configured.endsWith('/api') ? configured : `${configured}/api`;
};

const compassIntegrationToken = () =>
    process.env.ME_INTEGRATION_TOKEN ||
    process.env.ERP_INTEGRATION_TOKEN ||
    '';

// Fetch KoBo config from Compass. Returns null if Compass is unavailable.
export const fetchKoboConfigFromCompass = async () => {
    const token = compassIntegrationToken();
    if (!token) return null;
    try {
        const res = await fetch(`${compassApiBaseUrl()}/integration/kobo-config`, {
            headers: { 'x-integration-token': token, Accept: 'application/json' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.ok ? { server_url: data.server_url, api_token: data.api_token, source: 'compass' } : null;
    } catch {
        return null;
    }
};

const hasKoboConfigTable = async () => {
    const rows = await sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'kobo_config'
        ) AS exists
    `;
    return Boolean(rows[0]?.exists);
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            ensureAnyPermission(actor, ['kobo.manage', 'kobo.sync', 'approval.read'], {
                allowPending: true,
            });

            // Try Compass first
            const compassConfig = await fetchKoboConfigFromCompass();
            if (compassConfig) {
                return successResponse({
                    server_url: compassConfig.server_url,
                    api_token: compassConfig.api_token,
                    is_connected: true,
                    source: 'compass',
                });
            }

            // Fall back to local table
            if (!(await hasKoboConfigTable())) {
                return successResponse({
                    server_url: 'https://kf.kobotoolbox.org',
                    api_token: '',
                    is_connected: false,
                    storage_ready: false,
                    source: 'local',
                });
            }
            const configs = await sql`SELECT * FROM kobo_config LIMIT 1`;
            const data = configs.length > 0 ? configs[0] : null;
            return successResponse(
                data
                    ? { ...data, source: 'local' }
                    : { server_url: 'https://kf.kobotoolbox.org', api_token: '', is_connected: false, source: 'local' }
            );
        }

        // POST is kept for backward compatibility but directs users to Compass
        if (method === 'POST') {
            ensurePermission(actor, 'kobo.manage');
            return errorResponse(
                'KoBo credentials are now managed in Compass (Admin → Settings → KoBo Integration). Configure them there and the ERP will use the same token automatically.',
                400
            );
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Kobo config error:', error.message);
        return errorResponse(`Kobo configuration failed: ${error.message}`, 500);
    }
};
