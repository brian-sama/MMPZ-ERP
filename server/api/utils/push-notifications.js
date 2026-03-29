import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import { sql } from './db.js';

const PUSH_STORAGE_DIR = path.join(process.cwd(), 'uploads', 'push');
const PUSH_KEYS_FILE = path.join(PUSH_STORAGE_DIR, 'vapid-keys.json');
const PUSH_CONTACT = process.env.PUSH_CONTACT_EMAIL || 'mailto:admin@mmpz.local';

let vapidConfig = null;

const ensurePushStorageDir = () => {
    if (!fs.existsSync(PUSH_STORAGE_DIR)) {
        fs.mkdirSync(PUSH_STORAGE_DIR, { recursive: true });
    }
};

const loadVapidKeys = () => {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        return {
            publicKey: process.env.VAPID_PUBLIC_KEY,
            privateKey: process.env.VAPID_PRIVATE_KEY,
        };
    }

    ensurePushStorageDir();
    if (fs.existsSync(PUSH_KEYS_FILE)) {
        return JSON.parse(fs.readFileSync(PUSH_KEYS_FILE, 'utf8'));
    }

    const generated = webpush.generateVAPIDKeys();
    fs.writeFileSync(PUSH_KEYS_FILE, JSON.stringify(generated, null, 2), 'utf8');
    return generated;
};

const ensureVapidConfig = () => {
    if (vapidConfig) return vapidConfig;

    const keys = loadVapidKeys();
    webpush.setVapidDetails(PUSH_CONTACT, keys.publicKey, keys.privateKey);
    vapidConfig = {
        supported: Boolean(keys.publicKey && keys.privateKey),
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
    };
    return vapidConfig;
};

const buildSubscriptionRowPayload = (subscription) => ({
    endpoint: subscription?.endpoint || '',
    p256dhKey: subscription?.keys?.p256dh || '',
    authKey: subscription?.keys?.auth || '',
});

export const getPushConfiguration = async () => {
    const config = ensureVapidConfig();
    return {
        supported: config.supported,
        publicKey: config.publicKey,
    };
};

export const upsertPushSubscription = async (
    userId,
    subscription,
    userAgent,
    dbClient = sql
) => {
    const payload = buildSubscriptionRowPayload(subscription);
    if (!payload.endpoint || !payload.p256dhKey || !payload.authKey) {
        throw new Error('Invalid push subscription payload');
    }

    const rows = await dbClient`
        INSERT INTO push_subscriptions (
            user_id,
            endpoint,
            p256dh_key,
            auth_key,
            user_agent,
            updated_at,
            last_used_at
        )
        VALUES (
            ${userId},
            ${payload.endpoint},
            ${payload.p256dhKey},
            ${payload.authKey},
            ${userAgent || null},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (endpoint)
        DO UPDATE SET
            user_id = EXCLUDED.user_id,
            p256dh_key = EXCLUDED.p256dh_key,
            auth_key = EXCLUDED.auth_key,
            user_agent = EXCLUDED.user_agent,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP,
            last_used_at = CURRENT_TIMESTAMP
        RETURNING id, user_id, endpoint
    `;

    return rows[0];
};

export const deletePushSubscription = async (userId, endpoint, dbClient = sql) => {
    if (!endpoint) return;
    await dbClient`
        DELETE FROM push_subscriptions
        WHERE endpoint = ${endpoint}
          AND user_id = ${userId}
    `;
};

const markPushDeliverySuccess = async (subscriptionId, dbClient = sql) => {
    await dbClient`
        UPDATE push_subscriptions
        SET
            last_error = NULL,
            last_success_at = CURRENT_TIMESTAMP,
            last_used_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${subscriptionId}
    `;
};

const markPushDeliveryFailure = async (subscriptionId, message, dbClient = sql) => {
    await dbClient`
        UPDATE push_subscriptions
        SET
            last_error = ${message || 'Push delivery failed'},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${subscriptionId}
    `;
};

const removeInvalidSubscription = async (subscriptionId, dbClient = sql) => {
    await dbClient`DELETE FROM push_subscriptions WHERE id = ${subscriptionId}`;
};

export const sendPushNotificationsToUsers = async (
    userIds,
    payload,
    dbClient = sql
) => {
    const dedupedUserIds = [...new Set((userIds || []).map((value) => Number(value)).filter(Boolean))];
    if (dedupedUserIds.length === 0) return [];

    const config = ensureVapidConfig();
    if (!config.supported) return [];

    const subscriptions = await dbClient`
        SELECT id, user_id, endpoint, p256dh_key, auth_key
        FROM push_subscriptions
        WHERE user_id = ANY(${dbClient.array(dedupedUserIds, 'int4')})
    `;

    const results = [];
    for (const subscription of subscriptions) {
        try {
            await webpush.sendNotification(
                {
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: subscription.p256dh_key,
                        auth: subscription.auth_key,
                    },
                },
                JSON.stringify(payload),
                {
                    TTL: 60 * 60 * 30,
                }
            );
            await markPushDeliverySuccess(subscription.id, dbClient);
            results.push({ subscriptionId: subscription.id, ok: true });
        } catch (error) {
            const statusCode = Number(error.statusCode || error.status || 0);
            if (statusCode === 404 || statusCode === 410) {
                await removeInvalidSubscription(subscription.id, dbClient);
            } else {
                await markPushDeliveryFailure(subscription.id, error.message, dbClient);
            }
            results.push({ subscriptionId: subscription.id, ok: false, error: error.message });
        }
    }

    return results;
};
