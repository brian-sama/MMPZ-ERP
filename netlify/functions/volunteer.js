
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody } from './utils/response.js';

export const handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return corsResponse();
    }

    const path = event.path.replace('/api/volunteer/', '');
    const method = event.httpMethod;

    try {
        // --- SUBMISSIONS (Plans, Reports, etc.) ---
        if (path.startsWith('submit')) {
            if (method === 'POST') {
                const { userId, type, fileData, fileName, mimeType, description } = parseBody(event);

                if (!userId || !type || !fileData) {
                    return errorResponse('Missing required fields', 400);
                }

                // Basic validation for file size (approximate check on base64 length)
                // 4MB limit ~= 5.5MB base64 string
                if (fileData.length > 5500000) {
                    return errorResponse('File too large (max 4MB)', 413);
                }

                try {
                    const result = await sql`
                        INSERT INTO volunteer_submissions (user_id, type, file_data, file_name, mime_type, description)
                        VALUES (${userId}, ${type}, ${fileData}, ${fileName}, ${mimeType}, ${description})
                        RETURNING id, type, file_name, created_at
                    `;
                    return successResponse({ message: 'Submission successful', submission: result[0] });
                } catch (dbError) {
                    console.error('Submission error:', dbError);
                    return errorResponse('Database error', 500, dbError.message);
                }
            }
        }

        if (path.startsWith('submissions')) {
            if (method === 'GET') {
                const { role, userId } = event.queryStringParameters || {};

                let query;
                // Volunteers see only their own, Admins see all
                if (role === 'volunteer') {
                    query = sql`
                        SELECT id, user_id, type, file_name, mime_type, description, created_at, 
                        (LENGTH(file_data) > 0) as has_file -- Don't return full file data in list
                        FROM volunteer_submissions 
                        WHERE user_id = ${userId}
                        ORDER BY created_at DESC
                    `;
                } else if (['admin', 'director', 'officer', 'intern'].includes(role)) {
                    query = sql`
                        SELECT s.id, s.user_id, u.name as volunteer_name, s.type, s.file_name, s.mime_type, s.description, s.created_at,
                        (LENGTH(s.file_data) > 0) as has_file
                        FROM volunteer_submissions s
                        JOIN users u ON s.user_id = u.id
                        ORDER BY s.created_at DESC
                    `;
                } else {
                    return errorResponse('Unauthorized', 403);
                }

                const result = await query;
                return successResponse(result);
            }
        }

        // Endpoint to download a specific file
        if (path.startsWith('download/')) {
            const id = path.split('/')[1];
            if (method === 'GET') {
                const result = await sql`
                    SELECT file_data, file_name, mime_type 
                    FROM volunteer_submissions 
                    WHERE id = ${id}
                `;

                if (result.length === 0) return errorResponse('File not found', 404);

                const file = result[0];
                return successResponse(file);
            }
        }


        // --- ACTIVITY REPORTS ---
        if (path.startsWith('activity-report')) {
            if (method === 'POST') {
                const { userId, indicatorId, male, female, notes } = parseBody(event);
                if (!userId || !indicatorId) return errorResponse('Missing required fields', 400);

                try {
                    await sql`
                        INSERT INTO volunteer_activity_reports (user_id, indicator_id, male_count, female_count, notes)
                        VALUES (${userId}, ${indicatorId}, ${male || 0}, ${female || 0}, ${notes})
                    `;
                    return successResponse({ message: 'Activity report saved' });
                } catch (dbError) {
                    return errorResponse('Database error', 500, dbError.message);
                }
            }
        }

        // --- KOBO REQUESTS ---
        if (path.startsWith('kobo-request')) { // Handle both /kobo-request (POST) and /kobo-requests (GET)
            if (method === 'POST') {
                const { userId, formUid, formName, indicatorId } = parseBody(event);
                try {
                    await sql`
                        INSERT INTO kobo_form_links (kobo_form_uid, kobo_form_name, indicator_id, requested_by, status)
                        VALUES (${formUid}, ${formName}, ${indicatorId}, ${userId}, 'pending')
                    `;
                    return successResponse({ message: 'Request submitted' });
                } catch (dbError) {
                    return errorResponse('Database error', 500, dbError.message);
                }
            }

            if (method === 'GET') {
                const { userId } = event.queryStringParameters || {};
                try {
                    const requests = await sql`
                        SELECT kfl.*, i.title as indicator_title 
                        FROM kobo_form_links kfl
                        LEFT JOIN indicators i ON kfl.indicator_id = i.id
                        WHERE kfl.requested_by = ${userId}
                        ORDER BY kfl.id DESC
                    `;
                    return successResponse(requests);
                } catch (dbError) {
                    return errorResponse('Database error', 500, dbError.message);
                }
            }
        }

        // --- PARTICIPANTS (Legacy / View Only now mainly) ---
        if (path.startsWith('participants')) {
            if (method === 'GET') {
                const { role, userId } = event.queryStringParameters || {};

                let query;
                if (role === 'volunteer') {
                    // Show reports + direct participants? Just reports for now based on new UI
                    query = sql`SELECT * FROM volunteer_participants WHERE user_id = ${userId} ORDER BY created_at DESC`;
                } else if (['admin', 'director', 'officer', 'intern'].includes(role)) {
                    query = sql`
                        SELECT p.*, u.name as volunteer_name
                        FROM volunteer_participants p
                        JOIN users u ON p.user_id = u.id
                        ORDER BY p.created_at DESC
                    `;
                } else {
                    return errorResponse('Unauthorized', 403);
                }

                const result = await query;
                return successResponse(result);
            }
        }

        return errorResponse('Not found', 404);

    } catch (error) {
        console.error('Volunteer API error:', error);
        return errorResponse('Internal error', 500, error.message);
    }
};
