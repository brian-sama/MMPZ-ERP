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

const assertCalendarMutationAllowed = (actor) => {
    if (actor.role_code === 'DEVELOPMENT_FACILITATOR') {
        throw new HttpError('Development facilitators can view events but cannot manage the organization calendar.', 403);
    }
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const id = getPathParam(event, 'id') || getPathParam(event, 'calendar');
        const actor = await getUserContext(getRequestUserId(event, body));

        if (method === 'GET') {
            const limit = Math.min(Number.parseInt(query.limit || '100', 10) || 100, 200);
            let whereClause = sql`WHERE 1 = 1`;

            if (query.view === 'upcoming') {
                whereClause = sql`${whereClause} AND COALESCE(end_at, start_at) >= CURRENT_TIMESTAMP`;
            }
            if (query.view === 'past') {
                whereClause = sql`${whereClause} AND COALESCE(end_at, start_at) < CURRENT_TIMESTAMP`;
            }

            if (id) {
                const rows = await sql`
                    SELECT
                        ce.*,
                        cu.name AS created_by_name,
                        uu.name AS updated_by_name
                    FROM calendar_events ce
                    LEFT JOIN users cu ON ce.created_by_user_id = cu.id
                    LEFT JOIN users uu ON ce.updated_by_user_id = uu.id
                    WHERE ce.id = ${id}
                    LIMIT 1
                `;
                if (rows.length === 0) return errorResponse('Event not found', 404);
                return successResponse(rows[0]);
            }

            const rows = await sql`
                SELECT
                    ce.*,
                    cu.name AS created_by_name,
                    uu.name AS updated_by_name
                FROM calendar_events ce
                LEFT JOIN users cu ON ce.created_by_user_id = cu.id
                LEFT JOIN users uu ON ce.updated_by_user_id = uu.id
                ${whereClause}
                ORDER BY ce.start_at ASC
                LIMIT ${limit}
            `;

            if (query.countOnly === 'true') {
                return successResponse({
                    total: rows.length,
                    upcoming: rows.filter((item) => new Date(item.start_at).getTime() >= Date.now()).length,
                });
            }

            return successResponse(rows);
        }

        if (method === 'POST') {
            assertCalendarMutationAllowed(actor);
            if (!body.title || !body.start_at) {
                return errorResponse('title and start_at are required', 400);
            }

            const inserted = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                const rows = await tx`
                    INSERT INTO calendar_events (
                        title,
                        description,
                        event_type,
                        start_at,
                        end_at,
                        location,
                        created_by_user_id,
                        updated_by_user_id,
                        updated_at
                    )
                    VALUES (
                        ${body.title},
                        ${body.description || null},
                        ${body.event_type || 'internal_meeting'},
                        ${body.start_at},
                        ${body.end_at || null},
                        ${body.location || null},
                        ${actor.id},
                        ${actor.id},
                        CURRENT_TIMESTAMP
                    )
                    RETURNING *
                `;
                return rows[0];
            });

            return successResponse({ message: 'Event created successfully', event: inserted });
        }

        if (method === 'PUT') {
            assertCalendarMutationAllowed(actor);
            if (!id) return errorResponse('Event ID is required', 400);

            const existing = await sql`
                SELECT id
                FROM calendar_events
                WHERE id = ${id}
                LIMIT 1
            `;
            if (existing.length === 0) return errorResponse('Event not found', 404);

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`
                    UPDATE calendar_events
                    SET
                        title = COALESCE(${body.title}, title),
                        description = COALESCE(${body.description}, description),
                        event_type = COALESCE(${body.event_type}, event_type),
                        start_at = COALESCE(${body.start_at}, start_at),
                        end_at = COALESCE(${body.end_at}, end_at),
                        location = COALESCE(${body.location}, location),
                        reminder_24h_sent_at = CASE
                            WHEN ${body.start_at || null} IS NOT NULL THEN NULL
                            ELSE reminder_24h_sent_at
                        END,
                        updated_by_user_id = ${actor.id},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${id}
                `;
            });

            return successResponse({ message: 'Event updated successfully' });
        }

        if (method === 'DELETE') {
            assertCalendarMutationAllowed(actor);
            if (!id) return errorResponse('Event ID is required', 400);

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`DELETE FROM calendar_events WHERE id = ${id}`;
            });

            return successResponse({ message: 'Event deleted successfully' });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Calendar events API error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
