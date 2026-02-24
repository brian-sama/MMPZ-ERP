
import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody } from './utils/response.js';
import axios from 'axios';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        // Auth check
        const configs = await sql`SELECT * FROM kobo_config LIMIT 1`;
        if (configs.length === 0 || !configs[0].is_connected) {
            return errorResponse('KoboToolbox not connected', 400);
        }
        const config = configs[0];
        const headers = { 'Authorization': `Token ${config.api_token}` };

        const { action } = event.queryStringParameters || {};

        // 1. List Forms
        if (action === 'forms') {
            const res = await axios.get(`${config.server_url}/api/v2/assets.json`, { headers });
            const forms = res.data.results
                .filter(asset => asset.asset_type === 'survey')
                .map(asset => ({ uid: asset.uid, name: asset.name }));
            return successResponse(forms);
        }

        // 2. Get Fields (Inspect form schema/data to let user map columns)
        if (action === 'fields') {
            const { formId } = event.queryStringParameters;
            if (!formId) return errorResponse('Missing formId', 400);

            // Fetch data (limit 1) to see keys
            const res = await axios.get(`${config.server_url}/api/v2/assets/${formId}/data.json`, {
                headers,
                params: { limit: 1 }
            });

            if (res.data.results.length === 0) {
                return successResponse({ keys: [], message: 'No data found in this form to inspect fields.' });
            }

            // Extract keys from the first submission
            const submission = res.data.results[0];
            const keys = Object.keys(submission).filter(k => !k.startsWith('_') && !k.startsWith('meta/')); // Filter metadata
            return successResponse({ keys });
        }

        // 3. Perform Import
        if (event.httpMethod === 'POST') {
            const { formId, mapping, userId } = parseBody(event);
            // mapping = { name: 'q1_name', age: 'q2_age', ... }
            if (!formId || !mapping || !userId) return errorResponse('Missing required fields', 400);

            // Fetch ALL data
            const res = await axios.get(`${config.server_url}/api/v2/assets/${formId}/data.json`, { headers });
            const results = res.data.results;

            let cachedVolunteerName = 'System Import';
            try {
                const u = await sql`SELECT name FROM users WHERE id = ${userId}`;
                if (u.length > 0) cachedVolunteerName = u[0].name;
            } catch (e) { }

            let importedCount = 0;
            let skippedCount = 0;

            for (const sub of results) {
                const koboId = String(sub._id);

                // Map fields
                const name = sub[mapping.name];
                const age = parseInt(sub[mapping.age]) || null;
                const gender = sub[mapping.gender] || 'Unknown'; // Normalize if needed?
                const contact = sub[mapping.contact] || '';
                const eventDate = sub[mapping.date] || new Date().toISOString().split('T')[0];

                if (!name) {
                    skippedCount++;
                    continue;
                }

                // Check duplicate
                const existing = await sql`SELECT id FROM volunteer_participants WHERE kobo_submission_id = ${koboId}`;
                if (existing.length > 0) {
                    skippedCount++;
                    continue;
                }

                // Insert
                try {
                    await sql`
                        INSERT INTO volunteer_participants 
                        (user_id, name, age, gender, contact, event_date, kobo_submission_id)
                        VALUES 
                        (${userId}, ${name}, ${age}, ${gender}, ${contact}, ${eventDate}, ${koboId})
                    `;
                    importedCount++;
                } catch (err) {
                    console.error('Import insert error', err);
                    skippedCount++;
                }
            }

            return successResponse({
                message: `Import complete. ${importedCount} imported, ${skippedCount} skipped (duplicates or missing name).`,
                count: importedCount
            });
        }

        return errorResponse('Invalid action', 400);

    } catch (error) {
        console.error('Kobo Import Error:', error);
        return errorResponse(error.message, 500);
    }
};
