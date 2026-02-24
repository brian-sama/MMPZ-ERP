// Consolidated Indicators endpoint - Netlify Function
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams, getPathParam } from './utils/response.js';

export const handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return corsResponse();
    }

    try {
        const method = event.httpMethod;
        const id = getPathParam(event, 'id') || getPathParam(event, 'indicators');

        // GET - List or Details
        if (method === 'GET') {
            if (id) {
                // Get Single Indicator
                try {
                    const indicators = await sql`
                        SELECT i.*, u.name as owner_name 
                        FROM indicators i
                        LEFT JOIN users u ON i.created_by_user_id = u.id
                        WHERE i.id = ${id}
                    `;

                    if (!indicators || indicators.length === 0) return errorResponse('Indicator not found', 404);

                    return successResponse(indicators[0]);
                } catch (dbError) {
                    return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
                }
            } else {
                // List Indicators
                const { userId, role, search, status, priority } = getQueryParams(event);
                if (!userId || !role) return errorResponse('userId and role are required', 400);

                try {
                    // Start building the query
                    let query = sql`
                        SELECT i.*, u.name as owner_name 
                        FROM indicators i
                        LEFT JOIN users u ON i.created_by_user_id = u.id
                        WHERE 1=1
                    `;

                    // Role-based Access Control
                    // Admin, Director, and Volunteer can see ALL indicators (Volunteers are read-only)
                    // Officers/Interns see only their own (unless changed later)
                    if (role !== 'admin' && role !== 'director' && role !== 'volunteer') {
                        query = sql`${query} AND i.created_by_user_id = ${userId}`;
                    }

                    // Apply Filters
                    if (search) {
                        query = sql`${query} AND i.title ILIKE ${'%' + search + '%'}`;
                    }
                    if (status) {
                        query = sql`${query} AND i.status = ${status}`;
                    }
                    if (priority) {
                        query = sql`${query} AND i.priority = ${priority}`;
                    }

                    const data = await query;

                    const formatted = data.map(ind => ({
                        ...ind,
                        progress_percentage: ind.target_value > 0 ? Math.round((ind.current_value / ind.target_value) * 100) : 0,
                    }));

                    return successResponse(formatted);
                } catch (dbError) {
                    return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
                }
            }
        }

        // POST - Create
        if (method === 'POST') {
            const body = parseBody(event);
            const { title, userId, priority } = body;
            const targetValue = body.target_value !== undefined ? body.target_value : body.target;
            const budget = body.total_budget !== undefined ? body.total_budget : body.budget;

            if (!title || targetValue === undefined || budget === undefined || !userId) {
                return errorResponse('Missing required fields: title, target/target_value, budget/total_budget, userId', 400);
            }

            try {
                const inserted = await sql`
                    INSERT INTO indicators (
                        title, target_value, current_value, total_budget, 
                        current_budget_balance, created_by_user_id, priority, status
                    ) VALUES (
                        ${title}, ${targetValue}, 0, ${budget}, 
                        ${budget}, ${userId}, ${priority || 'medium'}, 'active'
                    ) RETURNING *
                `;
                return successResponse({ message: 'Indicator created successfully', indicator: inserted[0] });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // PUT - Update
        if (method === 'PUT') {
            if (!id) return errorResponse('Indicator ID is required', 400);
            const { title, target_value, total_budget, priority, status, userId, role } = parseBody(event);
            if (!userId || !role) return errorResponse('userId and role are required', 400);

            try {
                // Permission Check
                const indicators = await sql`SELECT created_by_user_id FROM indicators WHERE id = ${id}`;
                if (indicators.length === 0) return errorResponse('Indicator not found', 404);

                const fetchInd = indicators[0];
                if (fetchInd.created_by_user_id !== parseInt(userId) && role !== 'admin' && role !== 'director') {
                    return errorResponse('Permission denied', 403);
                }

                // Update fields
                await sql`
                    UPDATE indicators 
                    SET 
                        title = COALESCE(${title}, title),
                        target_value = COALESCE(${target_value}, target_value),
                        total_budget = COALESCE(${total_budget}, total_budget),
                        priority = COALESCE(${priority}, priority),
                        status = COALESCE(${status}, status)
                    WHERE id = ${id}
                `;

                return successResponse({ message: 'Indicator updated successfully' });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // DELETE - Delete
        if (method === 'DELETE') {
            if (!id) return errorResponse('Indicator ID is required', 400);
            const { userId, role } = parseBody(event);
            if (!userId || !role) return errorResponse('userId and role are required', 400);

            try {
                const indicators = await sql`SELECT created_by_user_id FROM indicators WHERE id = ${id}`;
                if (indicators.length === 0) return errorResponse('Indicator not found', 404);

                const fetchInd = indicators[0];
                if (fetchInd.created_by_user_id !== parseInt(userId) && role !== 'admin') {
                    return errorResponse('Permission denied', 403);
                }

                await sql`DELETE FROM indicators WHERE id = ${id}`;
                return successResponse({ message: 'Indicator deleted successfully' });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // PATCH - Special Actions
        if (method === 'PATCH') {
            if (!id) return errorResponse('Indicator ID is required', 400);
            const path = event.path;

            if (path.endsWith('/complete')) {
                try {
                    await sql`UPDATE indicators SET status = 'completed' WHERE id = ${id}`;
                    return successResponse({ message: 'Indicator marked as completed' });
                } catch (dbError) {
                    return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
                }
            }
        }

        return errorResponse('Method not allowed', 405);

    } catch (error) {
        console.error('Indicators function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
