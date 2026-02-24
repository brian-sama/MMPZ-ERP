// Consolidated Kobo Config endpoint - Netlify Function
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody } from './utils/response.js';
import axios from 'axios';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;

        // GET - Fetch Config
        if (method === 'GET') {
            try {
                const configs = await sql`SELECT * FROM kobo_config LIMIT 1`;
                const data = configs.length > 0 ? configs[0] : null;
                return successResponse(data || { server_url: 'https://kf.kobotoolbox.org', api_token: '', is_connected: false });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // POST - Save Config
        if (method === 'POST') {
            const { server_url, api_token } = parseBody(event);
            if (!server_url || !api_token) return errorResponse('server_url and api_token are required', 400);

            // Test Kobo Connection
            try {
                const testRes = await axios.get(`${server_url}/api/v2/assets/`, {
                    headers: { 'Authorization': `Token ${api_token}` },
                    timeout: 10000
                });

                const forms_count = testRes.data.count || 0;

                const existing = await sql`SELECT id FROM kobo_config LIMIT 1`;

                if (existing.length > 0) {
                    await sql`
                        UPDATE kobo_config 
                        SET server_url = ${server_url}, 
                            api_token = ${api_token}, 
                            is_connected = true, 
                            last_sync = ${new Date().toISOString()}
                        WHERE id = ${existing[0].id}
                    `;
                } else {
                    await sql`
                        INSERT INTO kobo_config (server_url, api_token, is_connected, last_sync)
                        VALUES (${server_url}, ${api_token}, true, ${new Date().toISOString()})
                    `;
                }

                return successResponse({ success: true, forms_count, message: `Connected successfully! Found ${forms_count} forms.` });

            } catch (koboError) {
                const detail = koboError.response?.data?.detail || koboError.message;
                return errorResponse(`Kobo Connection Failed: ${detail}`, 400, koboError.response?.data || koboError.message);
            }
        }

        return errorResponse('Method not allowed', 405);

    } catch (error) {
        console.error('Kobo config error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
