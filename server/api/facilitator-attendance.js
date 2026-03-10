import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensurePermission,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            const { project_id, date } = query;
            let rows;
            if (project_id && date) {
                rows = await sql`
                    SELECT fatt.*, u.name as facilitator_name
                    FROM facilitator_attendance fatt
                    JOIN facilitator_assignments fa ON fatt.assignment_id = fa.id
                    JOIN users u ON fa.facilitator_user_id = u.id
                    WHERE fa.project_id = ${project_id} AND fatt.date = ${date}
                `;
            } else if (project_id) {
                rows = await sql`
                    SELECT fatt.*, u.name as facilitator_name
                    FROM facilitator_attendance fatt
                    JOIN facilitator_assignments fa ON fatt.assignment_id = fa.id
                    JOIN users u ON fa.facilitator_user_id = u.id
                    WHERE fa.project_id = ${project_id}
                    ORDER BY fatt.date DESC
                `;
            } else {
                rows = await sql`SELECT * FROM facilitator_attendance ORDER BY date DESC LIMIT 100`;
            }
            return successResponse(rows);
        }

        if (method === 'POST') {
            // anyone with project read can log attendance? probably need specific permission
            ensurePermission(actor, 'activity.create');
            const { attendance_records } = body; // expect array of { assignment_id, date, status, notes }

            if (!Array.isArray(attendance_records)) return errorResponse('Attendance records array required', 400);

            await sql.begin(async (tx) => {
                for (const rec of attendance_records) {
                    await tx`
                        INSERT INTO facilitator_attendance (assignment_id, date, status, notes)
                        VALUES (${rec.assignment_id}, ${rec.date}, ${rec.status}, ${rec.notes || null})
                        ON CONFLICT (assignment_id, date) DO UPDATE SET
                            status = EXCLUDED.status,
                            notes = EXCLUDED.notes
                    `;
                }
            });
            return successResponse({ message: 'Attendance records saved' });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Facilitator Attendance function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
