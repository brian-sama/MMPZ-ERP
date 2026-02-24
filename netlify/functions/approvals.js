// Consolidated Approvals endpoint - Netlify Function
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, getPathParam, getQueryParams, parseBody } from './utils/response.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;

        const ALLOWED_ROLES = ['admin', 'director', 'officer', 'intern'];

        // GET - List Pending Approvals
        if (method === 'GET') {
            const { role } = getQueryParams(event);
            if (!ALLOWED_ROLES.includes(role)) {
                return errorResponse('Permission denied', 403);
            }

            try {
                // 1. Progress Updates (pending)
                const progress = await sql`
                    SELECT 
                        p.id, p.new_value, p.previous_value, p.notes, p.update_date, p.approval_status,
                        'progress_update' as type,
                        i.title as indicator_title, 
                        u.name as updated_by_name
                    FROM progress_updates p
                    LEFT JOIN indicators i ON p.indicator_id = i.id
                    LEFT JOIN users u ON p.updated_by_user_id = u.id
                    WHERE p.approval_status = 'pending'
                    ORDER BY p.update_date DESC
                `;

                // 2. Audited Progress Updates (ready for director approval after Kobo sync)
                const audited = await sql`
                    SELECT 
                        p.id, p.new_value, p.previous_value, p.notes, p.update_date, p.approval_status,
                        p.tally_value, p.tally_status,
                        'progress_update' as type,
                        i.title as indicator_title, 
                        u.name as updated_by_name
                    FROM progress_updates p
                    LEFT JOIN indicators i ON p.indicator_id = i.id
                    LEFT JOIN users u ON p.updated_by_user_id = u.id
                    WHERE p.approval_status = 'audited'
                    ORDER BY p.update_date DESC
                `;

                // 3. Kobo Link Requests
                const kobo = await sql`
                    SELECT 
                        k.id, k.kobo_form_uid, k.kobo_form_name, k.status, k.requested_by,
                        'kobo_link' as type,
                        i.title as indicator_title,
                        u.name as updated_by_name
                    FROM kobo_form_links k
                    LEFT JOIN indicators i ON k.indicator_id = i.id
                    LEFT JOIN users u ON k.requested_by = u.id
                    WHERE k.status = 'pending' OR k.status IS NULL
                    ORDER BY k.id DESC
                `;

                return successResponse({ progress, audited, kobo });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // PATCH - Approve/Reject
        if (method === 'PATCH') {
            const { id, type, action, userId, userRole } = parseBody(event);
            // type: 'progress_update' | 'kobo_link'

            if (!id || !action) return errorResponse('ID and Action required', 400);

            if (!ALLOWED_ROLES.includes(userRole)) {
                return errorResponse('Permission denied', 403);
            }

            if (type === 'progress_update') {
                if (action === 'approved') {
                    try {
                        const updates = await sql`SELECT * FROM progress_updates WHERE id = ${id}`;
                        if (updates.length === 0) return errorResponse('Update not found', 404);
                        const update = updates[0];

                        await sql`
                            UPDATE progress_updates SET
                                approval_status = 'approved',
                                approved_by_user_id = ${userId},
                                approval_date = ${new Date().toISOString()}
                            WHERE id = ${id}
                        `;
                        // Update indicator
                        await sql`UPDATE indicators SET current_value = ${update.new_value} WHERE id = ${update.indicator_id}`;

                        return successResponse({ message: 'Progress update approved' });
                    } catch (dbError) {
                        return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
                    }
                } else if (action === 'rejected') {
                    await sql`
                        UPDATE progress_updates SET
                            approval_status = 'rejected',
                            approved_by_user_id = ${userId},
                            approval_date = ${new Date().toISOString()}
                        WHERE id = ${id}
                    `;
                    return successResponse({ message: 'Progress update rejected' });
                }
            } else if (type === 'kobo_link') {
                if (action === 'approved') {
                    await sql`UPDATE kobo_form_links SET status = 'approved' WHERE id = ${id}`;
                    return successResponse({ message: 'Kobo Link approved. Syncing enabled.' });
                } else if (action === 'rejected') {
                    await sql`UPDATE kobo_form_links SET status = 'rejected' WHERE id = ${id}`;
                    return successResponse({ message: 'Kobo Link rejected.' });
                }
            }

            return errorResponse('Invalid type or action', 400);
        }

        return errorResponse('Method not allowed', 405);

    } catch (error) {
        console.error('Approvals function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
