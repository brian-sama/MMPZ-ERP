import { sql } from './utils/db.js';
import {
    successResponse,
    errorResponse,
    corsResponse,
    getPathParam,
    parseBody,
    getQueryParams,
} from './utils/response.js';
import axios from 'axios';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    ensurePermission,
    setAuditActor,
} from './utils/rbac.js';
import { createNotification } from './utils/notification-center.js';

const loadConfig = async () => {
    const configs = await sql`SELECT * FROM kobo_config LIMIT 1`;
    if (configs.length === 0 || !configs[0].is_connected) {
        throw new HttpError('KoboToolbox not connected', 400);
    }
    return configs[0];
};

const syncForm = async (link, config, actorId) => {
    const response = await axios.get(`${config.server_url}/api/v2/assets/${link.kobo_form_uid}/data.json`, {
        headers: { Authorization: `Token ${config.api_token}` },
    });

    const results = response.data.results || [];
    let newCount = 0;

    await sql.begin(async (tx) => {
        await setAuditActor(tx, actorId);

        for (const sub of results) {
            const subId = String(sub._id);
            const existing = await tx`
                SELECT id
                FROM kobo_submissions
                WHERE kobo_submission_id = ${subId}
                LIMIT 1
            `;

            if (existing.length === 0) {
                await tx`
                    INSERT INTO kobo_submissions (
                        kobo_submission_id,
                        kobo_form_uid,
                        indicator_id,
                        submission_data,
                        synced_at
                    )
                    VALUES (
                        ${subId},
                        ${link.kobo_form_uid},
                        ${link.indicator_id},
                        ${sub},
                        ${new Date().toISOString()}
                    )
                `;
                newCount += 1;
            }
        }

        await tx`
            UPDATE kobo_form_links
            SET
                submissions_count = ${results.length},
                last_synced_submission_id = ${results.length > 0 ? String(results[0]._id) : null}
            WHERE id = ${link.id}
        `;

        const pendingAudits = await tx`
            SELECT *
            FROM progress_updates
            WHERE indicator_id = ${link.indicator_id}
              AND approval_status = 'awaiting_audit'
            ORDER BY update_date DESC
        `;

        if (pendingAudits.length > 0) {
            const totalKoboSubmissions = results.length;
            for (const audit of pendingAudits) {
                const tallyMatches = Number(audit.new_value) === Number(totalKoboSubmissions);
                const tallyStatus = {
                    kobo_count: totalKoboSubmissions,
                    manual_value: audit.new_value,
                    matches: tallyMatches,
                    synced_at: new Date().toISOString(),
                };

                await tx`
                    UPDATE progress_updates
                    SET
                        tally_value = ${totalKoboSubmissions},
                        tally_status = ${tallyStatus},
                        approval_status = 'audited'
                    WHERE id = ${audit.id}
                `;

                const directors = await tx`SELECT id FROM users WHERE role_code = 'DIRECTOR'`;
                for (const director of directors) {
                    await createNotification(tx, {
                        userId: director.id,
                        type: 'approval_needed',
                        title: 'Audit ready for review',
                        message: `Progress update audited with Kobo. Manual: ${audit.new_value}, Kobo: ${totalKoboSubmissions}${tallyMatches ? ' (Match)' : ' (Mismatch)'}`,
                        relatedIndicatorId: link.indicator_id,
                        relatedEntityType: 'kobo_audit',
                        relatedEntityId: String(audit.id),
                        actionUrl: '/governance',
                    });
                }
            }
        } else if (newCount > 0) {
            await tx`
                UPDATE indicators
                SET
                    current_value = COALESCE(current_value, 0) + ${newCount},
                    last_updated = ${new Date().toISOString()}
                WHERE id = ${link.indicator_id}
            `;
        }
    });

    return newCount;
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const path = event.path;
        const id = getPathParam(event, 'id') || getPathParam(event, 'kobo');
        const body = parseBody(event);
        const query = getQueryParams(event);
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        // /forms
        if (path.includes('/forms')) {
            ensureAnyPermission(actor, ['kobo.manage', 'kobo.sync', 'approval.read'], {
                allowPending: true,
            });
            const config = await loadConfig();
            const res = await axios.get(`${config.server_url}/api/v2/assets/`, {
                headers: { Authorization: `Token ${config.api_token}` },
            });
            const forms = (res.data.results || [])
                .filter((asset) => asset.asset_type === 'survey')
                .map((asset) => ({ uid: asset.uid, name: asset.name }));
            return successResponse(forms);
        }

        // /links and /link
        if (path.includes('/links') || path.includes('/link')) {
            if (method === 'GET') {
                ensureAnyPermission(actor, ['kobo.manage', 'kobo.sync', 'approval.read'], {
                    allowPending: true,
                });
                const data = await sql`
                    SELECT kfl.*, i.title AS indicator_title
                    FROM kobo_form_links kfl
                    LEFT JOIN indicators i ON kfl.indicator_id = i.id
                    ORDER BY kfl.id DESC
                `;
                return successResponse(data);
            }

            if (method === 'POST') {
                ensurePermission(actor, 'kobo.manage');
                const { kobo_form_uid, kobo_form_name, indicator_id } = body;
                if (!kobo_form_uid || !indicator_id) {
                    return errorResponse('kobo_form_uid and indicator_id are required', 400);
                }

                const inserted = await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    const rows = await tx`
                        INSERT INTO kobo_form_links (
                            kobo_form_uid,
                            kobo_form_name,
                            indicator_id,
                            status,
                            requested_by
                        )
                        VALUES (
                            ${kobo_form_uid},
                            ${kobo_form_name || null},
                            ${indicator_id},
                            'approved',
                            ${actor.id}
                        )
                        RETURNING *
                    `;
                    return rows[0];
                });
                return successResponse(inserted);
            }

            if (method === 'DELETE' && id) {
                ensurePermission(actor, 'kobo.manage');
                await sql.begin(async (tx) => {
                    await setAuditActor(tx, actor.id);
                    await tx`DELETE FROM kobo_form_links WHERE id = ${id}`;
                });
                return successResponse({ message: 'Link deleted' });
            }
        }

        // /sync or /sync-all
        if (path.includes('/sync')) {
            ensurePermission(actor, 'kobo.sync');
            const config = await loadConfig();

            if (path.endsWith('/sync-all')) {
                const links = await sql`
                    SELECT *
                    FROM kobo_form_links
                    WHERE status = 'approved' OR status IS NULL
                `;
                let totalNew = 0;
                for (const link of links) {
                    totalNew += await syncForm(link, config, actor.id);
                }
                return successResponse({
                    message: `Sync complete. ${totalNew} new submissions processed.`,
                });
            }

            if (!id) return errorResponse('Link ID is required', 400);
            const links = await sql`
                SELECT *
                FROM kobo_form_links
                WHERE id = ${id}
                  AND (status = 'approved' OR status IS NULL)
                LIMIT 1
            `;
            if (links.length === 0) return errorResponse('Link not found', 404);

            const newSubmissions = await syncForm(links[0], config, actor.id);
            return successResponse({
                new_submissions: newSubmissions,
                message: 'Sync complete',
            });
        }

        // /import-participants
        if (path.includes('/import-participants') && method === 'POST') {
            ensurePermission(actor, 'kobo.manage');
            const { kobo_form_uid, mapping } = body;
            if (!kobo_form_uid || !mapping) return errorResponse('Missing form UID or mapping', 400);

            const subs = await sql`
                SELECT *
                FROM kobo_submissions
                WHERE kobo_form_uid = ${kobo_form_uid}
            `;

            let imported = 0;
            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                for (const sub of subs) {
                    const data = sub.submission_data;
                    const participant = {
                        name: data[mapping.name],
                        age: Number.parseInt(data[mapping.age], 10) || 0,
                        gender: data[mapping.gender] || null,
                        contact: data[mapping.contact] || '',
                        event_date: data[mapping.event_date] || data.today || new Date().toISOString(),
                        volunteer_name: data[mapping.volunteer_name] || 'Kobo Import',
                        kobo_submission_id: sub.kobo_submission_id,
                    };

                    if (!participant.name) continue;

                    await tx`
                        INSERT INTO volunteer_participants (
                            name,
                            age,
                            gender,
                            contact,
                            event_date,
                            volunteer_name,
                            kobo_submission_id,
                            user_id
                        )
                        VALUES (
                            ${participant.name},
                            ${participant.age},
                            ${participant.gender},
                            ${participant.contact},
                            ${participant.event_date},
                            ${participant.volunteer_name},
                            ${participant.kobo_submission_id},
                            ${actor.id}
                        )
                        ON CONFLICT (kobo_submission_id) DO NOTHING
                    `;
                    imported += 1;
                }
            });

            return successResponse({ message: `Imported ${imported} participants successfully.` });
        }

        // /fields/:uid
        if (path.includes('/fields/')) {
            ensureAnyPermission(actor, ['kobo.manage', 'kobo.sync'], { allowPending: true });
            const uid = path.split('/').pop();
            const sub = await sql`
                SELECT submission_data
                FROM kobo_submissions
                WHERE kobo_form_uid = ${uid}
                LIMIT 1
            `;
            if (sub.length === 0) return errorResponse('No data found for this form', 404);
            return successResponse(Object.keys(sub[0].submission_data || {}));
        }

        // /disconnect
        if (path.endsWith('/disconnect')) {
            ensurePermission(actor, 'kobo.manage');
            const config = await loadConfig();

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`DELETE FROM kobo_form_links`;
                await tx`
                    UPDATE kobo_config
                    SET is_connected = FALSE, api_token = ''
                    WHERE id = ${config.id}
                `;
            });

            return successResponse({ message: 'Disconnected' });
        }

        return errorResponse('Method not allowed or route not found', 404);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Kobo actions error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
