import { sql } from './utils/db.js';
import {
    successResponse,
    errorResponse,
    corsResponse,
    parseBody,
    getQueryParams,
} from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    ensurePermission,
    hasPermission,
    setAuditActor,
} from './utils/rbac.js';

const READ_OPERATIONS_PERMISSIONS = [
    'operations.inventory.read',
    'operations.assets.read',
    'operations.compliance.read',
    'operations.challenge_course.read',
];

const INVENTORY_MANAGE_PERMISSIONS = ['operations.inventory.manage'];
const ASSET_MANAGE_PERMISSIONS = ['operations.assets.manage', 'operations.assets.checkout'];
const COMPLIANCE_MANAGE_PERMISSIONS = ['operations.compliance.manage'];
const CHALLENGE_MANAGE_PERMISSIONS = ['operations.challenge_course.manage'];
const PROCUREMENT_EVIDENCE_PERMISSIONS = ['operations.procurement_evidence.manage'];

const REQUIRED_TABLES = [
    'inventory_items',
    'stock_movements',
    'stock_requests',
    'assets',
    'compliance_records',
    'challenge_course_sessions',
    'confidential_documents',
];

const asText = (value) => String(value || '').trim();
const asNullableText = (value) => {
    const text = asText(value);
    return text || null;
};
const asNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const asPositiveNumber = (value, label = 'Quantity') => {
    const parsed = asNumber(value, NaN);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new HttpError(`${label} must be greater than zero`, 400);
    }
    return parsed;
};
const asNullableInt = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
};
const asNullableDate = (value) => asNullableText(value);
const asJsonArray = (value) => (Array.isArray(value) ? value : []);

const hasAnyPermission = (actor, permissions) =>
    permissions.some((permission) => hasPermission(actor, permission));

const ensureOperationalSchema = async () => {
    const rows = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = ANY(${REQUIRED_TABLES})
    `;
    const existing = new Set(rows.map((row) => row.table_name));
    const missing = REQUIRED_TABLES.filter((tableName) => !existing.has(tableName));
    if (missing.length > 0) {
        throw new HttpError(
            `Operational accountability database migration is pending: ${missing.join(', ')}`,
            503
        );
    }
};

const getRoute = (event) =>
    String(event.path || '')
        .replace(/^\/api\/operations\/?/, '')
        .split('/')
        .filter(Boolean);

const getActor = async (event, body = {}) => {
    const query = getQueryParams(event);
    const userId = getRequestUserId(event, body) || query.userId;
    return getUserContext(userId);
};

const buildMovementDocumentPayload = (body) => {
    const documents = asJsonArray(body.supporting_documents || body.documents);
    const deliveryNote = asNullableText(body.delivery_note_reference);
    if (!deliveryNote) return documents;
    return [
        ...documents,
        {
            type: 'delivery_note',
            reference: deliveryNote,
        },
    ];
};

const loadInventory = async () => {
    const [items, movements, requests, deliveryNotes, metrics] = await Promise.all([
        sql`
            SELECT *
            FROM inventory_item_balances
            ORDER BY
                CASE WHEN available_quantity <= minimum_threshold THEN 0 ELSE 1 END,
                name ASC
        `,
        sql`
            SELECT
                sm.*,
                ii.name AS item_name,
                ii.unit AS item_unit,
                creator.name AS created_by_name,
                approver.name AS approved_by_name,
                requester.name AS requested_by_name,
                dn.reference_number AS delivery_note_reference
            FROM stock_movements sm
            JOIN inventory_items ii ON ii.id = sm.item_id
            LEFT JOIN users creator ON creator.id = sm.created_by_user_id
            LEFT JOIN users approver ON approver.id = sm.approved_by_user_id
            LEFT JOIN users requester ON requester.id = sm.requested_by_user_id
            LEFT JOIN delivery_notes dn ON dn.id = sm.delivery_note_id
            ORDER BY sm.movement_date DESC
            LIMIT 80
        `,
        sql`
            SELECT
                sr.*,
                requester.name AS requester_name,
                reviewer.name AS reviewer_name,
                approver.name AS approver_name,
                (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'id', sri.id,
                        'item_id', sri.item_id,
                        'item_name', ii.name,
                        'unit', ii.unit,
                        'quantity_requested', sri.quantity_requested,
                        'quantity_approved', sri.quantity_approved,
                        'quantity_issued', sri.quantity_issued,
                        'notes', sri.notes
                    ) ORDER BY ii.name), '[]'::jsonb)
                    FROM stock_request_items sri
                    JOIN inventory_items ii ON ii.id = sri.item_id
                    WHERE sri.request_id = sr.id
                ) AS items
            FROM stock_requests sr
            LEFT JOIN users requester ON requester.id = sr.requested_by_user_id
            LEFT JOIN users reviewer ON reviewer.id = sr.reviewed_by_user_id
            LEFT JOIN users approver ON approver.id = sr.approved_by_user_id
            ORDER BY sr.created_at DESC
            LIMIT 60
        `,
        sql`
            SELECT
                dn.*,
                receiver.name AS received_by_name,
                verifier.name AS verified_by_name,
                pr.title AS procurement_title,
                (
                    SELECT COUNT(*)::int
                    FROM stock_movements sm
                    WHERE sm.delivery_note_id = dn.id
                ) AS movement_count
            FROM delivery_notes dn
            LEFT JOIN users receiver ON receiver.id = dn.received_by_user_id
            LEFT JOIN users verifier ON verifier.id = dn.verified_by_user_id
            LEFT JOIN procurement_requests pr ON pr.id = dn.procurement_request_id
            ORDER BY dn.delivery_date DESC, dn.created_at DESC
            LIMIT 40
        `,
        sql`
            WITH balances AS (
                SELECT *
                FROM inventory_item_balances
            ),
            movement_totals AS (
                SELECT
                    COALESCE(SUM(CASE WHEN movement_direction = 'in' THEN quantity ELSE 0 END), 0)::numeric AS stock_in_30_days,
                    COALESCE(SUM(CASE WHEN movement_direction = 'out' THEN quantity ELSE 0 END), 0)::numeric AS stock_out_30_days
                FROM stock_movements
                WHERE movement_date >= NOW() - INTERVAL '30 days'
            )
            SELECT
                (SELECT COUNT(*)::int FROM balances WHERE status = 'active') AS total_items,
                (SELECT COUNT(*)::int FROM balances WHERE available_quantity <= minimum_threshold) AS low_stock_count,
                (SELECT COUNT(*)::int FROM stock_requests WHERE status IN ('submitted', 'reviewed', 'approved')) AS pending_request_count,
                (SELECT COUNT(*)::int FROM delivery_notes WHERE status = 'draft') AS pending_delivery_notes,
                mt.stock_in_30_days,
                mt.stock_out_30_days
            FROM movement_totals mt
        `,
    ]);

    return {
        metrics: metrics[0] || {
            total_items: 0,
            low_stock_count: 0,
            pending_request_count: 0,
            pending_delivery_notes: 0,
            stock_in_30_days: 0,
            stock_out_30_days: 0,
        },
        items,
        low_stock: items.filter((item) => Number(item.available_quantity || 0) <= Number(item.minimum_threshold || 0)),
        movements,
        requests,
        delivery_notes: deliveryNotes,
    };
};

const loadAssets = async () => {
    const [assets, assignments, vehicles, metrics] = await Promise.all([
        sql`
            SELECT
                a.*,
                holder.name AS assigned_user_name,
                vp.registration_number,
                vp.insurance_expiry,
                vp.service_due_date,
                vp.mileage,
                (
                    SELECT COUNT(*)::int
                    FROM asset_assignments aa
                    WHERE aa.asset_id = a.id
                ) AS assignment_count
            FROM assets a
            LEFT JOIN users holder ON holder.id = a.assigned_user_id
            LEFT JOIN vehicle_profiles vp ON vp.asset_id = a.id
            ORDER BY a.asset_code ASC
            LIMIT 100
        `,
        sql`
            SELECT
                aa.*,
                a.asset_code,
                a.name AS asset_name,
                assigned.name AS assigned_to_name,
                approver.name AS approved_by_name,
                checkout_user.name AS checked_out_by_name
            FROM asset_assignments aa
            JOIN assets a ON a.id = aa.asset_id
            LEFT JOIN users assigned ON assigned.id = aa.assigned_to_user_id
            LEFT JOIN users approver ON approver.id = aa.approved_by_user_id
            LEFT JOIN users checkout_user ON checkout_user.id = aa.checked_out_by_user_id
            ORDER BY aa.checkout_date DESC
            LIMIT 80
        `,
        sql`
            SELECT
                vp.*,
                a.asset_code,
                a.name AS asset_name,
                a.status AS asset_status,
                holder.name AS assigned_user_name
            FROM vehicle_profiles vp
            JOIN assets a ON a.id = vp.asset_id
            LEFT JOIN users holder ON holder.id = a.assigned_user_id
            ORDER BY vp.insurance_expiry ASC NULLS LAST
            LIMIT 40
        `,
        sql`
            SELECT
                COUNT(*)::int AS total_assets,
                COUNT(*) FILTER (WHERE status = 'checked_out')::int AS checked_out_assets,
                COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance_assets,
                COUNT(*) FILTER (WHERE warranty_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::int AS warranty_expiring_count,
                (
                    SELECT COUNT(*)::int
                    FROM asset_assignments
                    WHERE status = 'checked_out'
                      AND expected_return_date < CURRENT_DATE
                ) AS overdue_checkout_count,
                (
                    SELECT COUNT(*)::int
                    FROM vehicle_profiles
                    WHERE insurance_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
                       OR service_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
                ) AS vehicle_alert_count
            FROM assets
        `,
    ]);

    return {
        metrics: metrics[0] || {
            total_assets: 0,
            checked_out_assets: 0,
            maintenance_assets: 0,
            warranty_expiring_count: 0,
            overdue_checkout_count: 0,
            vehicle_alert_count: 0,
        },
        assets,
        assignments,
        vehicles,
    };
};

const loadCompliance = async () => {
    const [records, metrics] = await Promise.all([
        sql`
            SELECT
                cr.*,
                creator.name AS created_by_name,
                approver.name AS approved_by_name,
                (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'id', cdv.id,
                        'version_number', cdv.version_number,
                        'file_name', cdv.file_name,
                        'file_url', cdv.file_url,
                        'status', cdv.status,
                        'effective_date', cdv.effective_date,
                        'expiry_date', cdv.expiry_date,
                        'created_at', cdv.created_at
                    ) ORDER BY cdv.version_number DESC), '[]'::jsonb)
                    FROM compliance_document_versions cdv
                    WHERE cdv.record_id = cr.id
                ) AS versions
            FROM compliance_records cr
            LEFT JOIN users creator ON creator.id = cr.created_by_user_id
            LEFT JOIN users approver ON approver.id = cr.approved_by_user_id
            ORDER BY
                CASE
                    WHEN cr.expiry_date < CURRENT_DATE THEN 0
                    WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1
                    ELSE 2
                END,
                cr.expiry_date ASC NULLS LAST,
                cr.title ASC
            LIMIT 120
        `,
        sql`
            SELECT
                COUNT(*)::int AS total_records,
                COUNT(*) FILTER (WHERE compliance_status = 'compliant')::int AS compliant_count,
                COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE OR compliance_status = 'expired')::int AS expired_count,
                COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::int AS expiring_30_count,
                COUNT(*) FILTER (WHERE record_type = 'tax_clearance')::int AS tax_clearance_count,
                COUNT(*) FILTER (WHERE record_type = 'pvo_registration')::int AS pvo_record_count
            FROM compliance_records
        `,
    ]);

    return {
        metrics: metrics[0] || {
            total_records: 0,
            compliant_count: 0,
            expired_count: 0,
            expiring_30_count: 0,
            tax_clearance_count: 0,
            pvo_record_count: 0,
        },
        records,
        expiring: records.filter((record) => {
            if (!record.expiry_date) return false;
            const days = Math.ceil((new Date(record.expiry_date).getTime() - Date.now()) / 86400000);
            return days >= 0 && days <= 30;
        }),
    };
};

const loadChallengeCourse = async () => {
    const [sessions, activities, equipment, incidents, outcomes, metrics] = await Promise.all([
        sql`
            SELECT
                ccs.*,
                creator.name AS created_by_name,
                (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'confidence_score', cco.confidence_score,
                        'teamwork_score', cco.teamwork_score,
                        'leadership_score', cco.leadership_score,
                        'emotional_growth_score', cco.emotional_growth_score,
                        'created_at', cco.created_at
                    ) ORDER BY cco.created_at DESC), '[]'::jsonb)
                    FROM challenge_course_outcomes cco
                    WHERE cco.session_id = ccs.id
                ) AS outcomes
            FROM challenge_course_sessions ccs
            LEFT JOIN users creator ON creator.id = ccs.created_by_user_id
            ORDER BY ccs.session_date DESC
            LIMIT 80
        `,
        sql`
            SELECT *
            FROM challenge_course_activity_library
            WHERE active = TRUE
            ORDER BY name ASC
            LIMIT 100
        `,
        sql`
            SELECT
                cce.*,
                a.asset_code,
                a.status AS asset_status,
                iib.available_quantity,
                iib.unit AS inventory_unit
            FROM challenge_course_equipment cce
            LEFT JOIN assets a ON a.id = cce.asset_id
            LEFT JOIN inventory_item_balances iib ON iib.id = cce.inventory_item_id
            ORDER BY cce.name ASC
            LIMIT 100
        `,
        sql`
            SELECT
                cci.*,
                ccs.title AS session_title,
                reporter.name AS reported_by_name
            FROM challenge_course_incidents cci
            LEFT JOIN challenge_course_sessions ccs ON ccs.id = cci.session_id
            LEFT JOIN users reporter ON reporter.id = cci.reported_by_user_id
            ORDER BY cci.incident_date DESC
            LIMIT 50
        `,
        sql`
            SELECT
                cco.*,
                ccs.title AS session_title,
                recorder.name AS recorded_by_name
            FROM challenge_course_outcomes cco
            JOIN challenge_course_sessions ccs ON ccs.id = cco.session_id
            LEFT JOIN users recorder ON recorder.id = cco.recorded_by_user_id
            ORDER BY cco.created_at DESC
            LIMIT 50
        `,
        sql`
            SELECT
                COUNT(*)::int AS total_sessions,
                COUNT(*) FILTER (WHERE status IN ('planned', 'approved'))::int AS upcoming_sessions,
                COUNT(*) FILTER (WHERE risk_assessment_status <> 'approved')::int AS pending_safety_count,
                (
                    SELECT COUNT(*)::int
                    FROM challenge_course_incidents
                    WHERE severity IN ('high', 'critical')
                ) AS serious_incident_count,
                (
                    SELECT COUNT(*)::int
                    FROM challenge_course_equipment
                    WHERE status <> 'available'
                ) AS equipment_attention_count
            FROM challenge_course_sessions
        `,
    ]);

    return {
        metrics: metrics[0] || {
            total_sessions: 0,
            upcoming_sessions: 0,
            pending_safety_count: 0,
            serious_incident_count: 0,
            equipment_attention_count: 0,
        },
        sessions,
        activities,
        equipment,
        incidents,
        outcomes,
    };
};

const loadConfidential = async (actor) => {
    ensurePermission(actor, 'operations.confidential.read', { allowPending: true });

    const [documents, logs, metrics] = await Promise.all([
        sql`
            SELECT
                cd.*,
                creator.name AS created_by_name,
                approver.name AS approved_by_name,
                (
                    SELECT COUNT(*)::int
                    FROM confidential_document_access_logs cdal
                    WHERE cdal.document_id = cd.id
                ) AS access_count,
                (
                    SELECT MAX(opened_at)
                    FROM confidential_document_access_logs cdal
                    WHERE cdal.document_id = cd.id
                ) AS last_accessed_at
            FROM confidential_documents cd
            LEFT JOIN users creator ON creator.id = cd.created_by_user_id
            LEFT JOIN users approver ON approver.id = cd.approved_by_user_id
            ORDER BY cd.updated_at DESC
            LIMIT 80
        `,
        sql`
            SELECT
                cdal.*,
                cd.title AS document_title,
                u.name AS user_name
            FROM confidential_document_access_logs cdal
            JOIN confidential_documents cd ON cd.id = cdal.document_id
            LEFT JOIN users u ON u.id = cdal.user_id
            ORDER BY cdal.opened_at DESC
            LIMIT 80
        `,
        sql`
            SELECT
                COUNT(*)::int AS total_documents,
                COUNT(*) FILTER (WHERE sensitivity_level = 'board_only')::int AS board_only_count,
                COUNT(*) FILTER (WHERE view_only = TRUE)::int AS view_only_count,
                (
                    SELECT COUNT(*)::int
                    FROM confidential_document_access_logs
                    WHERE opened_at >= NOW() - INTERVAL '30 days'
                ) AS access_30_days
            FROM confidential_documents
        `,
    ]);

    return {
        metrics: metrics[0] || {
            total_documents: 0,
            board_only_count: 0,
            view_only_count: 0,
            access_30_days: 0,
        },
        documents,
        access_logs: logs,
    };
};

const loadDashboard = async (actor) => {
    const [inventory, assets, compliance, challenge] = await Promise.all([
        hasAnyPermission(actor, ['operations.inventory.read']) ? loadInventory() : Promise.resolve(null),
        hasAnyPermission(actor, ['operations.assets.read']) ? loadAssets() : Promise.resolve(null),
        hasAnyPermission(actor, ['operations.compliance.read']) ? loadCompliance() : Promise.resolve(null),
        hasAnyPermission(actor, ['operations.challenge_course.read']) ? loadChallengeCourse() : Promise.resolve(null),
    ]);

    let confidential = null;
    if (hasPermission(actor, 'operations.confidential.read')) {
        confidential = await loadConfidential(actor);
    }

    return { inventory, assets, compliance, challenge_course: challenge, confidential };
};

const assertStockAvailable = async (dbClient, itemId, quantity, movementDirection) => {
    if (!['out', 'reserve'].includes(movementDirection)) return;
    const rows = await dbClient`
        SELECT available_quantity, name
        FROM inventory_item_balances
        WHERE id = ${itemId}
        LIMIT 1
    `;
    if (rows.length === 0) throw new HttpError('Inventory item not found', 404);
    if (Number(rows[0].available_quantity || 0) < Number(quantity || 0)) {
        throw new HttpError(
            `${rows[0].name} has insufficient available stock for this movement`,
            400
        );
    }
};

const createInventoryItem = async (actor, body) => {
    ensurePermission(actor, 'operations.inventory.manage');
    const name = asText(body.name);
    if (!name) throw new HttpError('Item name is required', 400);

    const created = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        return tx`
            INSERT INTO inventory_items (
                name,
                category,
                unit,
                minimum_threshold,
                operational_threshold,
                storage_location,
                created_by_user_id
            )
            VALUES (
                ${name},
                ${asNullableText(body.category) || 'General'},
                ${asNullableText(body.unit) || 'unit'},
                ${asNumber(body.minimum_threshold, 0)},
                ${asNumber(body.operational_threshold, 0)},
                ${asNullableText(body.storage_location)},
                ${actor.id}
            )
            RETURNING *
        `;
    });

    return created[0];
};

const createStockMovement = async (actor, body) => {
    ensureAnyPermission(actor, INVENTORY_MANAGE_PERMISSIONS);

    const itemId = asText(body.item_id);
    if (!itemId) throw new HttpError('Inventory item is required', 400);

    const quantity = asPositiveNumber(body.quantity);
    const movementType = asNullableText(body.movement_type) || 'physical_count_adjustment';
    const movementDirection = asNullableText(body.movement_direction) || 'in';
    const documents = buildMovementDocumentPayload(body);

    const result = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        await assertStockAvailable(tx, itemId, quantity, movementDirection);

        const inserted = await tx`
            INSERT INTO stock_movements (
                item_id,
                movement_type,
                movement_direction,
                quantity,
                source,
                destination,
                linked_activity_id,
                linked_procurement_id,
                stock_request_id,
                delivery_note_id,
                requested_by_user_id,
                approved_by_user_id,
                created_by_user_id,
                movement_date,
                supporting_documents,
                remarks
            )
            VALUES (
                ${itemId},
                ${movementType},
                ${movementDirection},
                ${quantity},
                ${asNullableText(body.source)},
                ${asNullableText(body.destination)},
                ${asNullableInt(body.linked_activity_id)},
                ${asNullableText(body.linked_procurement_id)},
                ${asNullableText(body.stock_request_id)},
                ${asNullableText(body.delivery_note_id)},
                ${asNullableInt(body.requested_by_user_id)},
                ${actor.id},
                ${actor.id},
                ${asNullableDate(body.movement_date) || new Date().toISOString()},
                ${sql.json(documents)},
                ${asNullableText(body.remarks)}
            )
            RETURNING *
        `;

        const balance = await tx`
            SELECT *
            FROM inventory_item_balances
            WHERE id = ${itemId}
            LIMIT 1
        `;

        return { movement: inserted[0], balance: balance[0] || null };
    });

    return result;
};

const createStockRequest = async (actor, body) => {
    ensurePermission(actor, 'operations.inventory.request');
    const title = asText(body.title);
    if (!title) throw new HttpError('Request title is required', 400);
    const items = asJsonArray(body.items);
    if (items.length === 0) throw new HttpError('At least one requested item is required', 400);

    const request = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);

        const inserted = await tx`
            INSERT INTO stock_requests (
                title,
                reason,
                linked_activity_id,
                district,
                destination,
                requested_by_user_id,
                requested_for_date
            )
            VALUES (
                ${title},
                ${asNullableText(body.reason)},
                ${asNullableInt(body.linked_activity_id)},
                ${asNullableText(body.district)},
                ${asNullableText(body.destination)},
                ${actor.id},
                ${asNullableDate(body.requested_for_date)}
            )
            RETURNING *
        `;

        for (const item of items) {
            const itemId = asText(item.item_id);
            if (!itemId) throw new HttpError('Every requested line needs an item', 400);
            await tx`
                INSERT INTO stock_request_items (
                    request_id,
                    item_id,
                    quantity_requested,
                    notes
                )
                VALUES (
                    ${inserted[0].id},
                    ${itemId},
                    ${asPositiveNumber(item.quantity_requested || item.quantity, 'Requested quantity')},
                    ${asNullableText(item.notes)}
                )
            `;
        }

        return inserted[0];
    });

    return request;
};

const actionStockRequest = async (actor, id, body) => {
    ensureAnyPermission(actor, INVENTORY_MANAGE_PERMISSIONS);
    const action = asText(body.action).toLowerCase();
    if (!['review', 'approve', 'reject', 'issue'].includes(action)) {
        throw new HttpError('Unsupported stock request action', 400);
    }

    const result = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        const requests = await tx`
            SELECT *
            FROM stock_requests
            WHERE id = ${id}
            LIMIT 1
        `;
        if (requests.length === 0) throw new HttpError('Stock request not found', 404);

        if (action === 'reject') {
            const updated = await tx`
                UPDATE stock_requests
                SET status = 'rejected',
                    reviewed_by_user_id = ${actor.id},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING *
            `;
            return updated[0];
        }

        if (action === 'review') {
            const updated = await tx`
                UPDATE stock_requests
                SET status = 'reviewed',
                    reviewed_by_user_id = ${actor.id},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING *
            `;
            return updated[0];
        }

        if (action === 'approve') {
            await tx`
                UPDATE stock_request_items
                SET quantity_approved = COALESCE(quantity_approved, quantity_requested)
                WHERE request_id = ${id}
            `;
            const updated = await tx`
                UPDATE stock_requests
                SET status = 'approved',
                    approved_by_user_id = ${actor.id},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING *
            `;
            return updated[0];
        }

        const lines = await tx`
            SELECT
                sri.*,
                ii.name AS item_name
            FROM stock_request_items sri
            JOIN inventory_items ii ON ii.id = sri.item_id
            WHERE sri.request_id = ${id}
            ORDER BY ii.name ASC
        `;

        if (lines.length === 0) throw new HttpError('Stock request has no line items', 400);

        for (const line of lines) {
            const quantityToIssue = asNumber(line.quantity_approved, asNumber(line.quantity_requested, 0));
            if (quantityToIssue <= 0) continue;
            await assertStockAvailable(tx, line.item_id, quantityToIssue, 'out');
            await tx`
                INSERT INTO stock_movements (
                    item_id,
                    movement_type,
                    movement_direction,
                    quantity,
                    source,
                    destination,
                    stock_request_id,
                    requested_by_user_id,
                    approved_by_user_id,
                    created_by_user_id,
                    supporting_documents,
                    remarks
                )
                VALUES (
                    ${line.item_id},
                    'activity_distribution',
                    'out',
                    ${quantityToIssue},
                    'Store',
                    ${requests[0].destination || requests[0].district || requests[0].title},
                    ${id},
                    ${requests[0].requested_by_user_id},
                    ${actor.id},
                    ${actor.id},
                    ${sql.json(asJsonArray(body.supporting_documents))},
                    ${asNullableText(body.remarks) || `Issued against ${requests[0].request_number}`}
                )
            `;
            await tx`
                UPDATE stock_request_items
                SET quantity_issued = ${quantityToIssue},
                    quantity_approved = COALESCE(quantity_approved, quantity_requested)
                WHERE id = ${line.id}
            `;
        }

        const updated = await tx`
            UPDATE stock_requests
            SET status = 'issued',
                approved_by_user_id = COALESCE(approved_by_user_id, ${actor.id}),
                issued_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
            RETURNING *
        `;
        return updated[0];
    });

    return result;
};

const createDeliveryNote = async (actor, body) => {
    ensureAnyPermission(actor, INVENTORY_MANAGE_PERMISSIONS);
    const items = asJsonArray(body.items);

    const result = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        const deliveryNote = await tx`
            INSERT INTO delivery_notes (
                reference_number,
                supplier,
                procurement_request_id,
                delivery_date,
                received_by_user_id,
                verified_by_user_id,
                condition_status,
                receiver_signature_url,
                document_url,
                remarks,
                status
            )
            VALUES (
                ${asNullableText(body.reference_number) || `DN-${Date.now()}`},
                ${asNullableText(body.supplier)},
                ${asNullableText(body.procurement_request_id)},
                ${asNullableDate(body.delivery_date) || new Date().toISOString().slice(0, 10)},
                ${asNullableInt(body.received_by_user_id) || actor.id},
                ${body.status === 'verified' || body.create_stock_in ? actor.id : null},
                ${asNullableText(body.condition_status) || 'pending'},
                ${asNullableText(body.receiver_signature_url)},
                ${asNullableText(body.document_url)},
                ${asNullableText(body.remarks)},
                ${body.status === 'verified' || body.create_stock_in ? 'verified' : 'draft'}
            )
            RETURNING *
        `;

        if (body.create_stock_in) {
            for (const item of items) {
                await tx`
                    INSERT INTO stock_movements (
                        item_id,
                        movement_type,
                        movement_direction,
                        quantity,
                        source,
                        destination,
                        linked_procurement_id,
                        delivery_note_id,
                        approved_by_user_id,
                        created_by_user_id,
                        supporting_documents,
                        remarks
                    )
                    VALUES (
                        ${asText(item.item_id)},
                        'procurement',
                        'in',
                        ${asPositiveNumber(item.quantity)},
                        ${asNullableText(body.supplier) || 'Supplier'},
                        ${asNullableText(body.destination) || 'Store'},
                        ${asNullableText(body.procurement_request_id)},
                        ${deliveryNote[0].id},
                        ${actor.id},
                        ${actor.id},
                        ${sql.json([{ type: 'delivery_note', reference: deliveryNote[0].reference_number }])},
                        ${asNullableText(item.remarks) || asNullableText(body.remarks)}
                    )
                `;
            }
        }

        return deliveryNote[0];
    });

    return result;
};

const createProcurementEvidence = async (actor, body) => {
    ensureAnyPermission(actor, PROCUREMENT_EVIDENCE_PERMISSIONS);
    const entityType = asText(body.entity_type);
    const entityId = asText(body.entity_id);
    const evidenceType = asText(body.evidence_type);
    if (!entityType || !entityId || !evidenceType) {
        throw new HttpError('Evidence type, entity type, and entity id are required', 400);
    }

    const inserted = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        return tx`
            INSERT INTO procurement_evidence (
                entity_type,
                entity_id,
                evidence_type,
                file_name,
                file_url,
                extracted_vendor,
                extracted_total,
                extracted_date,
                uploaded_by_user_id
            )
            VALUES (
                ${entityType},
                ${entityId},
                ${evidenceType},
                ${asNullableText(body.file_name)},
                ${asNullableText(body.file_url)},
                ${asNullableText(body.extracted_vendor)},
                ${asNumber(body.extracted_total, null)},
                ${asNullableDate(body.extracted_date)},
                ${actor.id}
            )
            RETURNING *
        `;
    });
    return inserted[0];
};

const createAsset = async (actor, body) => {
    ensurePermission(actor, 'operations.assets.manage');
    const assetCode = asText(body.asset_code);
    const name = asText(body.name);
    if (!assetCode || !name) throw new HttpError('Asset code and name are required', 400);

    const result = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        const asset = await tx`
            INSERT INTO assets (
                asset_code,
                asset_type,
                name,
                serial_number,
                purchase_date,
                purchase_value,
                condition_status,
                current_location,
                warranty_expiry,
                qr_code_payload,
                created_by_user_id
            )
            VALUES (
                ${assetCode},
                ${asNullableText(body.asset_type) || 'equipment'},
                ${name},
                ${asNullableText(body.serial_number)},
                ${asNullableDate(body.purchase_date)},
                ${asNumber(body.purchase_value, null)},
                ${asNullableText(body.condition_status) || 'good'},
                ${asNullableText(body.current_location)},
                ${asNullableDate(body.warranty_expiry)},
                ${asNullableText(body.qr_code_payload) || assetCode},
                ${actor.id}
            )
            RETURNING *
        `;

        if (body.vehicle?.registration_number) {
            await tx`
                INSERT INTO vehicle_profiles (
                    asset_id,
                    registration_number,
                    insurance_expiry,
                    service_due_date,
                    mileage
                )
                VALUES (
                    ${asset[0].id},
                    ${asText(body.vehicle.registration_number)},
                    ${asNullableDate(body.vehicle.insurance_expiry)},
                    ${asNullableDate(body.vehicle.service_due_date)},
                    ${asNumber(body.vehicle.mileage, 0)}
                )
            `;
        }

        return asset[0];
    });

    return result;
};

const checkoutAsset = async (actor, body) => {
    ensureAnyPermission(actor, ASSET_MANAGE_PERMISSIONS);
    const assetId = asText(body.asset_id);
    const assignedTo = asNullableInt(body.assigned_to_user_id);
    if (!assetId || !assignedTo) throw new HttpError('Asset and assigned user are required', 400);

    const result = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        const assets = await tx`
            SELECT *
            FROM assets
            WHERE id = ${assetId}
            LIMIT 1
        `;
        if (assets.length === 0) throw new HttpError('Asset not found', 404);
        if (!['available', 'maintenance'].includes(assets[0].status) && body.force !== true) {
            throw new HttpError('Asset is not available for checkout', 400);
        }

        const assignment = await tx`
            INSERT INTO asset_assignments (
                asset_id,
                assigned_to_user_id,
                approved_by_user_id,
                checked_out_by_user_id,
                expected_return_date,
                checkout_condition,
                checkout_signature_url,
                remarks
            )
            VALUES (
                ${assetId},
                ${assignedTo},
                ${actor.id},
                ${actor.id},
                ${asNullableDate(body.expected_return_date)},
                ${asNullableText(body.checkout_condition) || assets[0].condition_status || 'good'},
                ${asNullableText(body.checkout_signature_url)},
                ${asNullableText(body.remarks)}
            )
            RETURNING *
        `;

        await tx`
            UPDATE assets
            SET status = 'checked_out',
                assigned_user_id = ${assignedTo},
                current_location = COALESCE(${asNullableText(body.destination)}, current_location),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${assetId}
        `;

        return assignment[0];
    });

    return result;
};

const returnAsset = async (actor, id, body) => {
    ensureAnyPermission(actor, ASSET_MANAGE_PERMISSIONS);
    const result = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        const rows = await tx`
            SELECT *
            FROM asset_assignments
            WHERE id = ${id}
            LIMIT 1
        `;
        if (rows.length === 0) throw new HttpError('Asset assignment not found', 404);

        const updated = await tx`
            UPDATE asset_assignments
            SET status = 'returned',
                return_date = CURRENT_TIMESTAMP,
                return_condition = ${asNullableText(body.return_condition) || 'good'},
                return_signature_url = ${asNullableText(body.return_signature_url)},
                remarks = COALESCE(${asNullableText(body.remarks)}, remarks)
            WHERE id = ${id}
            RETURNING *
        `;

        await tx`
            UPDATE assets
            SET status = 'available',
                assigned_user_id = NULL,
                condition_status = ${asNullableText(body.return_condition) || 'good'},
                current_location = COALESCE(${asNullableText(body.current_location)}, current_location),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${rows[0].asset_id}
        `;

        return updated[0];
    });
    return result;
};

const createComplianceRecord = async (actor, body) => {
    ensureAnyPermission(actor, COMPLIANCE_MANAGE_PERMISSIONS);
    const title = asText(body.title);
    if (!title) throw new HttpError('Compliance title is required', 400);

    const record = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        return tx`
            INSERT INTO compliance_records (
                record_type,
                title,
                reference_number,
                issuing_authority,
                issue_date,
                expiry_date,
                renewal_status,
                compliance_status,
                owner_department,
                remarks,
                created_by_user_id,
                approved_by_user_id
            )
            VALUES (
                ${asNullableText(body.record_type) || 'legal_document'},
                ${title},
                ${asNullableText(body.reference_number)},
                ${asNullableText(body.issuing_authority)},
                ${asNullableDate(body.issue_date)},
                ${asNullableDate(body.expiry_date)},
                ${asNullableText(body.renewal_status) || 'not_started'},
                ${asNullableText(body.compliance_status) || 'pending'},
                ${asNullableText(body.owner_department)},
                ${asNullableText(body.remarks)},
                ${actor.id},
                ${asNullableInt(body.approved_by_user_id)}
            )
            RETURNING *
        `;
    });

    return record[0];
};

const createComplianceVersion = async (actor, body) => {
    ensureAnyPermission(actor, COMPLIANCE_MANAGE_PERMISSIONS);
    const recordId = asText(body.record_id);
    if (!recordId) throw new HttpError('Compliance record is required', 400);

    const version = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        const nextVersion = await tx`
            SELECT COALESCE(MAX(version_number), 0) + 1 AS version_number
            FROM compliance_document_versions
            WHERE record_id = ${recordId}
        `;
        await tx`
            UPDATE compliance_document_versions
            SET status = 'superseded'
            WHERE record_id = ${recordId}
              AND status = 'current'
        `;
        return tx`
            INSERT INTO compliance_document_versions (
                record_id,
                version_number,
                file_name,
                file_url,
                uploaded_by_user_id,
                approved_by_user_id,
                status,
                effective_date,
                expiry_date,
                notes
            )
            VALUES (
                ${recordId},
                ${nextVersion[0].version_number},
                ${asNullableText(body.file_name)},
                ${asNullableText(body.file_url)},
                ${actor.id},
                ${asNullableInt(body.approved_by_user_id)},
                'current',
                ${asNullableDate(body.effective_date)},
                ${asNullableDate(body.expiry_date)},
                ${asNullableText(body.notes)}
            )
            RETURNING *
        `;
    });

    return version[0];
};

const createChallengeSession = async (actor, body) => {
    ensureAnyPermission(actor, CHALLENGE_MANAGE_PERMISSIONS);
    const title = asText(body.title);
    if (!title) throw new HttpError('Session title is required', 400);

    const inserted = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        return tx`
            INSERT INTO challenge_course_sessions (
                title,
                session_date,
                location,
                participant_group,
                participant_count,
                facilitators,
                risk_assessment_status,
                waiver_status,
                status,
                created_by_user_id
            )
            VALUES (
                ${title},
                ${asNullableDate(body.session_date) || new Date().toISOString().slice(0, 10)},
                ${asNullableText(body.location)},
                ${asNullableText(body.participant_group)},
                ${asNullableInt(body.participant_count) || 0},
                ${sql.json(asJsonArray(body.facilitators))},
                ${asNullableText(body.risk_assessment_status) || 'pending'},
                ${asNullableText(body.waiver_status) || 'pending'},
                ${asNullableText(body.status) || 'planned'},
                ${actor.id}
            )
            RETURNING *
        `;
    });

    return inserted[0];
};

const createChallengeIncident = async (actor, body) => {
    ensureAnyPermission(actor, CHALLENGE_MANAGE_PERMISSIONS);
    const description = asText(body.description);
    if (!description) throw new HttpError('Incident description is required', 400);

    const inserted = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        return tx`
            INSERT INTO challenge_course_incidents (
                session_id,
                severity,
                participant_name,
                description,
                action_taken,
                reported_by_user_id
            )
            VALUES (
                ${asNullableText(body.session_id)},
                ${asNullableText(body.severity) || 'low'},
                ${asNullableText(body.participant_name)},
                ${description},
                ${asNullableText(body.action_taken)},
                ${actor.id}
            )
            RETURNING *
        `;
    });

    return inserted[0];
};

const createChallengeOutcome = async (actor, body) => {
    ensureAnyPermission(actor, CHALLENGE_MANAGE_PERMISSIONS);
    const sessionId = asText(body.session_id);
    if (!sessionId) throw new HttpError('Session is required', 400);

    const inserted = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        return tx`
            INSERT INTO challenge_course_outcomes (
                session_id,
                participant_count,
                confidence_score,
                teamwork_score,
                leadership_score,
                emotional_growth_score,
                debrief_notes,
                recorded_by_user_id
            )
            VALUES (
                ${sessionId},
                ${asNullableInt(body.participant_count) || 0},
                ${asNumber(body.confidence_score, null)},
                ${asNumber(body.teamwork_score, null)},
                ${asNumber(body.leadership_score, null)},
                ${asNumber(body.emotional_growth_score, null)},
                ${asNullableText(body.debrief_notes)},
                ${actor.id}
            )
            RETURNING *
        `;
    });

    return inserted[0];
};

const createConfidentialDocument = async (actor, body) => {
    ensurePermission(actor, 'operations.confidential.manage');
    const title = asText(body.title);
    if (!title) throw new HttpError('Confidential document title is required', 400);

    const inserted = await sql.begin(async (tx) => {
        await setAuditActor(tx, actor.id);
        return tx`
            INSERT INTO confidential_documents (
                category,
                title,
                sensitivity_level,
                file_name,
                file_url,
                view_only,
                watermark_required,
                created_by_user_id,
                approved_by_user_id,
                status,
                expiry_date
            )
            VALUES (
                ${asNullableText(body.category) || 'other'},
                ${title},
                ${asNullableText(body.sensitivity_level) || 'restricted'},
                ${asNullableText(body.file_name)},
                ${asNullableText(body.file_url)},
                ${body.view_only !== false},
                ${body.watermark_required !== false},
                ${actor.id},
                ${asNullableInt(body.approved_by_user_id)},
                ${asNullableText(body.status) || 'active'},
                ${asNullableDate(body.expiry_date)}
            )
            RETURNING *
        `;
    });

    return inserted[0];
};

const logConfidentialAccess = async (actor, body, event) => {
    ensurePermission(actor, 'operations.confidential.read', { allowPending: true });
    const documentId = asText(body.document_id);
    if (!documentId) throw new HttpError('Document is required', 400);
    const viewedAt = new Date();
    const watermark = `CONFIDENTIAL Viewed by ${actor.name || actor.email} ${viewedAt.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })}`;

    const inserted = await sql`
        INSERT INTO confidential_document_access_logs (
            document_id,
            user_id,
            action,
            duration_seconds,
            ip_address,
            user_agent,
            watermark_text
        )
        VALUES (
            ${documentId},
            ${actor.id},
            ${asNullableText(body.action) || 'viewed'},
            ${asNullableInt(body.duration_seconds)},
            ${asNullableText(event.headers?.['x-forwarded-for']) || asNullableText(event.headers?.['x-real-ip'])},
            ${asNullableText(event.headers?.['user-agent'])},
            ${watermark}
        )
        RETURNING *
    `;

    return inserted[0];
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const [resource, id, subresource] = getRoute(event);
        const actor = await getActor(event, body);

        await ensureOperationalSchema();

        if (method === 'GET') {
            if (!resource || resource === 'dashboard') {
                ensureAnyPermission(actor, READ_OPERATIONS_PERMISSIONS, { allowPending: true });
                return successResponse(await loadDashboard(actor));
            }
            if (resource === 'inventory') {
                ensurePermission(actor, 'operations.inventory.read', { allowPending: true });
                return successResponse(await loadInventory());
            }
            if (resource === 'assets') {
                ensurePermission(actor, 'operations.assets.read', { allowPending: true });
                return successResponse(await loadAssets());
            }
            if (resource === 'compliance') {
                ensurePermission(actor, 'operations.compliance.read', { allowPending: true });
                return successResponse(await loadCompliance());
            }
            if (resource === 'challenge-course') {
                ensurePermission(actor, 'operations.challenge_course.read', { allowPending: true });
                return successResponse(await loadChallengeCourse());
            }
            if (resource === 'confidential') {
                return successResponse(await loadConfidential(actor));
            }
            return errorResponse('Operations route not found', 404);
        }

        if (method === 'POST') {
            if (resource === 'inventory-items') {
                return successResponse(await createInventoryItem(actor, body), 201);
            }
            if (resource === 'stock-movements') {
                return successResponse(await createStockMovement(actor, body), 201);
            }
            if (resource === 'stock-requests') {
                return successResponse(await createStockRequest(actor, body), 201);
            }
            if (resource === 'delivery-notes') {
                return successResponse(await createDeliveryNote(actor, body), 201);
            }
            if (resource === 'procurement-evidence') {
                return successResponse(await createProcurementEvidence(actor, body), 201);
            }
            if (resource === 'assets') {
                return successResponse(await createAsset(actor, body), 201);
            }
            if (resource === 'asset-checkouts') {
                return successResponse(await checkoutAsset(actor, body), 201);
            }
            if (resource === 'compliance-records') {
                return successResponse(await createComplianceRecord(actor, body), 201);
            }
            if (resource === 'compliance-versions') {
                return successResponse(await createComplianceVersion(actor, body), 201);
            }
            if (resource === 'challenge-course-sessions') {
                return successResponse(await createChallengeSession(actor, body), 201);
            }
            if (resource === 'challenge-course-incidents') {
                return successResponse(await createChallengeIncident(actor, body), 201);
            }
            if (resource === 'challenge-course-outcomes') {
                return successResponse(await createChallengeOutcome(actor, body), 201);
            }
            if (resource === 'confidential-documents') {
                return successResponse(await createConfidentialDocument(actor, body), 201);
            }
            if (resource === 'confidential-access') {
                return successResponse(await logConfidentialAccess(actor, body, event), 201);
            }
            return errorResponse('Operations route not found', 404);
        }

        if (method === 'PATCH') {
            if (resource === 'stock-requests' && id) {
                return successResponse(await actionStockRequest(actor, id, body));
            }
            if (resource === 'asset-checkouts' && id && (!subresource || subresource === 'return')) {
                return successResponse(await returnAsset(actor, id, body));
            }
            return errorResponse('Operations route not found', 404);
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Operations function error:', error);
        return errorResponse('Internal server error', 500);
    }
};
