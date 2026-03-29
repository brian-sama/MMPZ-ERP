import { EventEmitter } from 'events';

const realtimeBus = globalThis.__mmpzRealtimeBus || new EventEmitter();
realtimeBus.setMaxListeners(0);
globalThis.__mmpzRealtimeBus = realtimeBus;

export const subscribeRealtime = (listener) => {
    realtimeBus.on('event', listener);
    return () => realtimeBus.off('event', listener);
};

export const emitRealtimeEvent = (payload) => {
    realtimeBus.emit('event', payload);
};

export const createNotification = async (
    dbClient,
    {
        userId,
        type = 'system',
        title,
        message = null,
        relatedIndicatorId = null,
        relatedEntityType = null,
        relatedEntityId = null,
        actionUrl = null,
    }
) => {
    const rows = await dbClient`
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            related_indicator_id,
            related_entity_type,
            related_entity_id,
            action_url
        )
        VALUES (
            ${userId},
            ${type},
            ${title},
            ${message},
            ${relatedIndicatorId},
            ${relatedEntityType},
            ${relatedEntityId},
            ${actionUrl}
        )
        RETURNING *
    `;

    const notification = rows[0];
    emitRealtimeEvent({
        kind: 'notification',
        user_id: notification.user_id,
        notification,
    });
    return notification;
};

export const createNotifications = async (dbClient, payloads) => {
    const created = [];
    for (const payload of payloads) {
        if (!payload?.userId) continue;
        created.push(await createNotification(dbClient, payload));
    }
    return created;
};
