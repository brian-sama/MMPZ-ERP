import { sql } from '../api/utils/db.js';
import { createNotifications } from '../api/utils/notification-center.js';
import { sendPushNotificationsToUsers } from '../api/utils/push-notifications.js';

const REMINDER_LOCK_KEY = 24032901;
const REMINDER_INTERVAL_MS = Number(process.env.CALENDAR_REMINDER_INTERVAL_MS || 15 * 60 * 1000);

let reminderTimer = null;
let reminderRunInProgress = false;

const formatReminderTime = (value) =>
    new Date(value).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

const buildReminderMessage = (eventItem) => {
    const base = `${eventItem.title} starts on ${formatReminderTime(eventItem.start_at)}.`;
    return eventItem.location ? `${base} Venue: ${eventItem.location}.` : base;
};

export const processCalendarEventReminders = async () => {
    if (reminderRunInProgress) return;
    reminderRunInProgress = true;

    let queuedPushes = [];

    try {
        await sql.begin(async (tx) => {
            const lockRows = await tx`SELECT pg_try_advisory_xact_lock(${REMINDER_LOCK_KEY}) AS locked`;
            if (!lockRows[0]?.locked) {
                return;
            }

            const dueEvents = await tx`
                SELECT id, title, start_at, location, event_type
                FROM calendar_events
                WHERE reminder_24h_sent_at IS NULL
                  AND start_at > CURRENT_TIMESTAMP + INTERVAL '23 hours'
                  AND start_at <= CURRENT_TIMESTAMP + INTERVAL '25 hours'
                ORDER BY start_at ASC
            `;

            if (dueEvents.length === 0) {
                return;
            }

            const userRows = await tx`
                SELECT id
                FROM users
            `;
            const userIds = [...new Set(userRows.map((row) => Number(row.id)).filter(Boolean))];

            if (userIds.length === 0) {
                return;
            }

            for (const eventItem of dueEvents) {
                const title = `Event reminder: ${eventItem.title}`;
                const message = buildReminderMessage(eventItem);

                await createNotifications(
                    tx,
                    userIds.map((userId) => ({
                        userId,
                        type: 'calendar_reminder',
                        title,
                        message,
                        relatedEntityType: 'calendar_event',
                        relatedEntityId: eventItem.id,
                        actionUrl: '/intranet/calendar',
                    }))
                );

                await tx`
                    UPDATE calendar_events
                    SET reminder_24h_sent_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${eventItem.id}
                `;

                queuedPushes.push({
                    userIds,
                    payload: {
                        title,
                        body: message,
                        url: '/intranet/calendar',
                        tag: `calendar-reminder-${eventItem.id}`,
                        icon: '/mmpz-logo.png',
                        badge: '/mmpz-logo.png',
                        eventId: eventItem.id,
                    },
                });
            }
        });

        for (const pushJob of queuedPushes) {
            await sendPushNotificationsToUsers(pushJob.userIds, pushJob.payload);
        }
    } catch (error) {
        console.error('Calendar reminder job failed:', error);
    } finally {
        reminderRunInProgress = false;
    }
};

export const startCalendarReminderScheduler = () => {
    processCalendarEventReminders();

    if (reminderTimer) {
        clearInterval(reminderTimer);
    }

    reminderTimer = setInterval(processCalendarEventReminders, REMINDER_INTERVAL_MS);
    reminderTimer.unref?.();

    return () => {
        if (reminderTimer) {
            clearInterval(reminderTimer);
            reminderTimer = null;
        }
    };
};
