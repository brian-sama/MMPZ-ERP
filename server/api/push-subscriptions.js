import { corsResponse, errorResponse, parseBody, successResponse } from './utils/response.js';
import { getPushConfiguration, upsertPushSubscription, deletePushSubscription } from './utils/push-notifications.js';
import { HttpError, getRequestUserId, getUserContext } from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const actor = await getUserContext(getRequestUserId(event, body));

        if (method === 'GET') {
            return successResponse(await getPushConfiguration());
        }

        if (method === 'POST') {
            if (!body.subscription) {
                return errorResponse('subscription is required', 400);
            }

            const saved = await upsertPushSubscription(
                actor.id,
                body.subscription,
                event.headers?.['user-agent'] || event.headers?.['User-Agent'] || null
            );

            return successResponse({
                message: 'Push subscription saved',
                subscription: saved,
            });
        }

        if (method === 'DELETE') {
            const endpoint = body.endpoint || body.subscription?.endpoint;
            if (!endpoint) {
                return errorResponse('endpoint is required', 400);
            }

            await deletePushSubscription(actor.id, endpoint);
            return successResponse({ message: 'Push subscription removed' });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Push subscription API error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
