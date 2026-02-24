// Consolidated Progress endpoint - Netlify Function
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getPathParam } from './utils/response.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const indicatorId = getPathParam(event, 'indicators');

        if (!indicatorId) return errorResponse('Indicator ID is required', 400);

        // GET - List Progress History
        if (method === 'GET') {
            try {
                const data = await sql`
                    SELECT 
                        p.*, 
                        u1.name as updated_by_name, 
                        u2.name as approved_by_name
                    FROM progress_updates p
                    LEFT JOIN users u1 ON p.updated_by_user_id = u1.id
                    LEFT JOIN users u2 ON p.approved_by_user_id = u2.id
                    WHERE p.indicator_id = ${indicatorId}
                    ORDER BY p.update_date DESC
                `;
                return successResponse(data);
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }

        // POST - Create Progress Update
        if (method === 'POST') {
            const body = parseBody(event);
            const { notes, userId } = body;

            // Support both snake_case and camelCase
            let newValue = body.new_value !== undefined ? body.new_value : body.newValue;
            let prevValue = body.previous_value !== undefined ? body.previous_value : body.previousValue;
            const finalIndicatorId = indicatorId || body.indicator_id || body.indicatorId;

            // Tighten Validation: newValue must be a valid number
            newValue = parseInt(newValue);
            if (isNaN(newValue) || newValue < 0) {
                return errorResponse('New value must be a valid positive number', 400);
            }

            if (!userId || !finalIndicatorId) {
                return errorResponse('userId and indicatorId are required', 400);
            }

            try {
                // Security Fix: Fetch true role from DB instead of trusting request body
                const userQuery = await sql`SELECT role FROM users WHERE id = ${userId}`;
                if (userQuery.length === 0) {
                    return errorResponse('User not found', 404);
                }
                const actualRole = userQuery[0].role;

                // If user is admin/director, auto-approve
                const isAutoApproved = actualRole === 'admin' || actualRole === 'director';

                // Check if this indicator has a linked Kobo form for audit workflow
                let approvalStatus = isAutoApproved ? 'approved' : 'pending';
                if (!isAutoApproved) {
                    const koboLinks = await sql`SELECT id FROM kobo_form_links WHERE indicator_id = ${finalIndicatorId} AND sync_enabled = TRUE`;
                    if (koboLinks.length > 0) {
                        approvalStatus = 'awaiting_audit';
                    }
                }

                const inserted = await sql`
                    INSERT INTO progress_updates (
                        indicator_id, updated_by_user_id, previous_value, 
                        new_value, notes, approval_status, 
                        approved_by_user_id, approval_date
                    ) VALUES (
                        ${finalIndicatorId}, ${userId}, ${prevValue || 0}, 
                        ${newValue}, ${notes}, ${approvalStatus}, 
                        ${isAutoApproved ? userId : null}, ${isAutoApproved ? new Date().toISOString() : null}
                    ) RETURNING *
                `;

                if (isAutoApproved) {
                    // Update indicator current value
                    await sql`UPDATE indicators SET current_value = ${newValue} WHERE id = ${finalIndicatorId}`;
                } else {
                    // Create notification for directors/admins
                    const directors = await sql`SELECT id FROM users WHERE role = 'director' OR role = 'admin'`;
                    if (directors && directors.length > 0) {
                        const notifMessage = approvalStatus === 'awaiting_audit'
                            ? 'A new progress update is awaiting Kobo audit.'
                            : 'A new progress update needs your approval.';
                        for (const d of directors) {
                            await sql`
                                INSERT INTO notifications (user_id, type, title, message, related_indicator_id)
                                VALUES (${d.id}, 'approval_needed', 'Progress Approval Needed', ${notifMessage}, ${finalIndicatorId})
                            `;
                        }
                    }
                }

                return successResponse({ message: 'Progress update submitted successfully', update: inserted[0] });
            } catch (dbError) {
                return errorResponse(`Database error: ${dbError.message}`, 500, dbError);
            }
        }


        return errorResponse('Method not allowed', 405);

    } catch (error) {
        console.error('Progress function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
