import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
    setAuditActor,
} from './utils/rbac.js';

const SETTING_KEY = 'major_finance_threshold_usd';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            ensurePermission(actor, 'settings.finance_threshold.read', { allowPending: true });
            const rows = await sql`
                SELECT setting_key, value_text, description, updated_at, updated_by_user_id
                FROM system_settings
                WHERE setting_key = ${SETTING_KEY}
                LIMIT 1
            `;

            if (rows.length === 0) {
                return successResponse({
                    setting_key: SETTING_KEY,
                    value_text: '500.00',
                    description: 'Expense amount threshold requiring Director final approval',
                });
            }

            return successResponse(rows[0]);
        }

        if (method === 'PATCH') {
            ensurePermission(actor, 'settings.finance_threshold.update');

            const value = Number.parseFloat(body.value ?? body.value_text);
            if (Number.isNaN(value) || value < 0) {
                return errorResponse('A valid non-negative threshold value is required', 400);
            }

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`
                    INSERT INTO system_settings (
                        setting_key,
                        value_text,
                        description,
                        updated_by_user_id,
                        updated_at
                    )
                    VALUES (
                        ${SETTING_KEY},
                        ${value.toFixed(2)},
                        ${'Expense amount threshold requiring Director final approval'},
                        ${actor.id},
                        ${new Date().toISOString()}
                    )
                    ON CONFLICT (setting_key)
                    DO UPDATE SET
                        value_text = EXCLUDED.value_text,
                        description = EXCLUDED.description,
                        updated_by_user_id = EXCLUDED.updated_by_user_id,
                        updated_at = EXCLUDED.updated_at
                `;
            });

            return successResponse({
                message: 'Finance threshold updated successfully',
                setting_key: SETTING_KEY,
                value_text: value.toFixed(2),
            });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Finance threshold settings error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
