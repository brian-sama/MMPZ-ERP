// Consolidated Activities endpoint - Netlify Function
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getPathParam } from './utils/response.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const id = getPathParam(event, 'id') || getPathParam(event, 'activities');
        const indicatorId = getPathParam(event, 'indicators');

        // GET - List Activities (often grouped by indicator)
        if (method === 'GET') {
            try {
                let query = sql`SELECT * FROM activities WHERE 1=1`;
                if (indicatorId) {
                    query = sql`${query} AND indicator_id = ${indicatorId}`;
                }
                const data = await sql`${query} ORDER BY activity_date DESC`;
                return successResponse(data);
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // POST - Create Activity
        if (method === 'POST') {
            const { indicator_id, description, category, cost } = parseBody(event);
            if (!indicator_id || !description || cost === undefined) {
                return errorResponse('Missing required fields', 400);
            }

            try {
                const inserted = await sql`
                    INSERT INTO activities (indicator_id, description, category, cost) 
                    VALUES (${indicator_id}, ${description}, ${category || 'other'}, ${cost}) 
                    RETURNING *
                `;

                const activity = inserted[0];

                // Subtract cost from indicator budget balance
                await sql`
                    UPDATE indicators 
                    SET current_budget_balance = current_budget_balance - ${cost} 
                    WHERE id = ${indicator_id}
                `;

                return successResponse({ message: 'Activity created successfully', activity });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // DELETE - Delete Activity
        if (method === 'DELETE') {
            if (!id) return errorResponse('Activity ID is required', 400);

            try {
                // Get activity info before deleting to add cost back to budget
                const activities = await sql`SELECT indicator_id, cost FROM activities WHERE id = ${id}`;
                if (activities.length === 0) return errorResponse('Activity not found', 404);

                const activity = activities[0];

                await sql`DELETE FROM activities WHERE id = ${id}`;

                // Add cost back to indicator budget balance
                await sql`
                    UPDATE indicators 
                    SET current_budget_balance = current_budget_balance + ${activity.cost} 
                    WHERE id = ${activity.indicator_id}
                `;

                return successResponse({ message: 'Activity deleted successfully' });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        return errorResponse('Method not allowed', 405);

    } catch (error) {
        console.error('Activities function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
