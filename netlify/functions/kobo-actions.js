// Consolidated Kobo Actions (Forms, Links, Syncing)
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, getPathParam, parseBody } from './utils/response.js';
import axios from 'axios';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const path = event.path;
        const id = getPathParam(event, 'id') || getPathParam(event, 'kobo');

        // Fetch config
        const configs = await sql`SELECT * FROM kobo_config LIMIT 1`;
        if (configs.length === 0 || !configs[0].is_connected) {
            return errorResponse('KoboToolbox not connected', 400);
        }
        const config = configs[0];

        // --- FORMS LIST ---
        if (path.includes('/forms')) {
            const res = await axios.get(`${config.server_url}/api/v2/assets/`, {
                headers: { 'Authorization': `Token ${config.api_token}` }
            });
            const forms = res.data.results
                .filter(asset => asset.asset_type === 'survey')
                .map(asset => ({ uid: asset.uid, name: asset.name }));
            return successResponse(forms);
        }

        // --- LINKS ---
        if (path.includes('/link')) {
            if (method === 'GET') {
                try {
                    const data = await sql`
                        SELECT kfl.*, i.title as indicator_title 
                        FROM kobo_form_links kfl
                        LEFT JOIN indicators i ON kfl.indicator_id = i.id
                    `;
                    return successResponse(data);
                } catch (dbError) {
                    return errorResponse(dbError.message, 500);
                }
            }
            if (method === 'POST') {
                const { kobo_form_uid, kobo_form_name, indicator_id } = parseBody(event);
                try {
                    const inserted = await sql`
                        INSERT INTO kobo_form_links (kobo_form_uid, kobo_form_name, indicator_id) 
                        VALUES (${kobo_form_uid}, ${kobo_form_name}, ${indicator_id}) 
                        RETURNING *
                    `;
                    return successResponse(inserted[0]);
                } catch (dbError) {
                    return errorResponse(dbError.message, 500);
                }
            }
            if (method === 'DELETE' && id) {
                try {
                    await sql`DELETE FROM kobo_form_links WHERE id = ${id}`;
                    return successResponse({ message: 'Link deleted' });
                } catch (dbError) {
                    return errorResponse(dbError.message, 500);
                }
            }
        }

        // --- SYNC ---
        if (path.includes('/sync')) {
            const body = parseBody(event) || {};
            const userId = body.userId;

            if (userId) {
                const user = await sql`SELECT role FROM users WHERE id = ${userId}`;
                if (user.length === 0 || (user[0].role !== 'admin' && user[0].role !== 'director' && user[0].role !== 'officer')) {
                    return errorResponse('Unauthorized to perform sync', 403);
                }
            }

            if (path.endsWith('/sync-all')) {
                // Fetch all links
                try {
                    const links = await sql`SELECT * FROM kobo_form_links WHERE status = 'approved' OR status IS NULL`;
                    let totalNew = 0;
                    for (const link of links) {
                        try {
                            totalNew += await syncForm(link, config);
                        } catch (e) {
                            console.error(`Failed to sync form ${link.kobo_form_uid}:`, e);
                        }
                    }
                    return successResponse({ message: `Sync complete. ${totalNew} new submissions processed.` });
                } catch (dbError) {
                    return errorResponse(dbError.message, 500);
                }
            }

            if (id) {
                // Sync single form
                try {
                    const links = await sql`SELECT * FROM kobo_form_links WHERE id = ${id} AND (status = 'approved' OR status IS NULL)`;
                    if (links.length === 0) return errorResponse('Link not found', 404);
                    const link = links[0];

                    const newSubmissions = await syncForm(link, config);
                    return successResponse({ new_submissions: newSubmissions, message: 'Sync complete' });
                } catch (e) {
                    return errorResponse(e.message || 'Sync failed', 500);
                }
            }
        }

        // Helper function for sync
        async function syncForm(link, config) {
            // 1. Fetch data from Kobo
            const koboUrl = `${config.server_url}/api/v2/assets/${link.kobo_form_uid}/data.json`;
            const response = await axios.get(koboUrl, {
                headers: { 'Authorization': `Token ${config.api_token}` }
            });

            const results = response.data.results || [];
            let newCount = 0;

            for (const sub of results) {
                const subId = String(sub._id);

                // Check if exists
                const existing = await sql`SELECT id FROM kobo_submissions WHERE kobo_submission_id = ${subId}`;

                if (existing.length === 0) {
                    // Insert
                    try {
                        await sql`
                            INSERT INTO kobo_submissions (
                                kobo_submission_id, kobo_form_uid, indicator_id, 
                                submission_data, synced_at
                            ) VALUES (
                                ${subId}, ${link.kobo_form_uid}, ${link.indicator_id}, 
                                ${sub}, ${new Date().toISOString()}
                            )
                        `;
                        newCount++;
                    } catch (insertError) {
                        console.error('Error inserting submission:', insertError);
                    }
                }
            }

            // 2. Update Link stats
            if (newCount > 0 || results.length !== link.submissions_count) {
                await sql`
                    UPDATE kobo_form_links SET
                        submissions_count = ${results.length},
                        last_synced_submission_id = ${results.length > 0 ? String(results[0]._id) : null}
                    WHERE id = ${link.id}
                `;
            }

            // 3. Audit workflow: Check for awaiting_audit progress updates
            const pendingAudits = await sql`
                SELECT * FROM progress_updates 
                WHERE indicator_id = ${link.indicator_id} AND approval_status = 'awaiting_audit'
                ORDER BY update_date DESC
            `;

            if (pendingAudits.length > 0) {
                // Calculate total submissions count as the tally value
                const totalKoboSubmissions = results.length;

                for (const audit of pendingAudits) {
                    const tallyMatches = audit.new_value === totalKoboSubmissions;
                    const tallyStatus = {
                        kobo_count: totalKoboSubmissions,
                        manual_value: audit.new_value,
                        matches: tallyMatches,
                        synced_at: new Date().toISOString()
                    };

                    await sql`
                        UPDATE progress_updates SET
                            tally_value = ${totalKoboSubmissions},
                            tally_status = ${tallyStatus},
                            approval_status = 'audited'
                        WHERE id = ${audit.id}
                    `;

                    // Notify directors that audit is ready for review
                    const directors = await sql`SELECT id FROM users WHERE role = 'director' OR role = 'admin'`;
                    for (const d of directors) {
                        await sql`
                            INSERT INTO notifications (user_id, type, title, message, related_indicator_id)
                            VALUES (${d.id}, 'approval_needed', 'Audit Ready for Review', 
                                    ${'Progress update audited with Kobo. Manual: ' + audit.new_value + ', Kobo: ' + totalKoboSubmissions + (tallyMatches ? ' (Match)' : ' (Mismatch)')}, 
                                    ${link.indicator_id})
                        `;
                    }
                }
            } else if (newCount > 0) {
                // No pending audits, update indicator directly (legacy behavior)
                await sql`
                    UPDATE indicators 
                    SET current_value = COALESCE(current_value, 0) + ${newCount} 
                    WHERE id = ${link.indicator_id}
                `;
            }

            return newCount;
        }

        // --- IMPORT PARTICIPANTS ---
        if (path.includes('/import-participants')) {
            if (method === 'POST') {
                const { kobo_form_uid, mapping } = parseBody(event);
                if (!kobo_form_uid || !mapping) return errorResponse('Missing form UID or mapping', 400);

                try {
                    // 1. Get cached submissions
                    const subs = await sql`SELECT * FROM kobo_submissions WHERE kobo_form_uid = ${kobo_form_uid}`;

                    let imported = 0;
                    for (const sub of subs) {
                        const data = sub.submission_data;

                        // Map fields
                        const participant = {
                            name: data[mapping.name],
                            age: parseInt(data[mapping.age]) || 0,
                            gender: data[mapping.gender],
                            contact: data[mapping.contact] || '',
                            event_date: data[mapping.event_date] || data['today'] || new Date().toISOString(),
                            volunteer_name: data[mapping.volunteer_name] || 'Kobo Import',
                            kobo_submission_id: sub.kobo_submission_id,
                            user_id: 0 // System/Admin user
                        };

                        // Validate required
                        if (!participant.name) continue;

                        // Insert if unique
                        // We use ON CONFLICT if the constraint exists, otherwise manual check
                        // Migration-3 added UNIQUE constraint to kobo_submission_id
                        try {
                            await sql`
                                INSERT INTO volunteer_participants (
                                    name, age, gender, contact, event_date, volunteer_name, kobo_submission_id, user_id
                                ) VALUES (
                                    ${participant.name}, ${participant.age}, ${participant.gender}, 
                                    ${participant.contact}, ${participant.event_date}, 
                                    ${participant.volunteer_name}, ${participant.kobo_submission_id}, ${participant.user_id}
                                )
                                ON CONFLICT (kobo_submission_id) DO NOTHING
                            `;
                            imported++;
                        } catch (e) {
                            console.error('Import insert error', e);
                        }
                    }

                    return successResponse({ message: `Imported ${imported} participants successfully.` });
                } catch (dbError) {
                    return errorResponse(dbError.message, 500);
                }
            }
        }

        // --- GET FIELDS (Helpers for Mapping) ---
        if (path.includes('/fields/')) {
            const uid = path.split('/').pop();
            try {
                const sub = await sql`SELECT submission_data FROM kobo_submissions WHERE kobo_form_uid = ${uid} LIMIT 1`;
                if (sub.length === 0) return errorResponse('No data found for this form to extract fields', 404);
                return successResponse(Object.keys(sub[0].submission_data));
            } catch (e) {
                return errorResponse(e.message, 500);
            }
        }

        // --- DISCONNECT ---
        if (path.endsWith('/disconnect')) {
            try {
                await sql`DELETE FROM kobo_form_links`; // Delete all links
                await sql`UPDATE kobo_config SET is_connected = false, api_token = '' WHERE id = ${config.id}`;
                return successResponse({ message: 'Disconnected' });
            } catch (dbError) {
                return errorResponse(dbError.message, 500);
            }
        }

        return errorResponse('Method not allowed or route not found', 404);

    } catch (error) {
        console.error('Kobo actions error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
