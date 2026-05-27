-- Migration: operational accountability platform modules
-- Adds inventory movements, asset custody, compliance versioning,
-- confidential access logging, procurement evidence, and Challenge Course records.

INSERT INTO permissions (code, description)
VALUES
    ('operations.compliance.read', 'View institutional governance and compliance records'),
    ('operations.compliance.manage', 'Create and update institutional governance and compliance records'),
    ('operations.inventory.read', 'View inventory balances, stock requests, and stock movements'),
    ('operations.inventory.request', 'Request stock for approved field, program, and logistics work'),
    ('operations.inventory.manage', 'Receive, issue, reserve, and reconcile inventory movements'),
    ('operations.assets.read', 'View enterprise assets, vehicles, and custody history'),
    ('operations.assets.checkout', 'Request or process asset checkout and return transactions'),
    ('operations.assets.manage', 'Create and update enterprise asset records'),
    ('operations.challenge_course.read', 'View Challenge Course sessions, safety, equipment, and outcome records'),
    ('operations.challenge_course.manage', 'Create and update Challenge Course operations records'),
    ('operations.confidential.read', 'View restricted executive workspace records'),
    ('operations.confidential.manage', 'Create and govern restricted executive workspace records'),
    ('operations.procurement_evidence.manage', 'Attach quotations, receipts, delivery notes, and vouchers to operational records')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_code, permission_code)
SELECT 'DIRECTOR', code
FROM permissions
WHERE code LIKE 'operations.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code)
SELECT 'SYSTEM_ADMIN', code
FROM permissions
WHERE code LIKE 'operations.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code) VALUES
    ('FINANCE_OFFICER', 'operations.compliance.read'),
    ('FINANCE_OFFICER', 'operations.compliance.manage'),
    ('FINANCE_OFFICER', 'operations.inventory.read'),
    ('FINANCE_OFFICER', 'operations.inventory.manage'),
    ('FINANCE_OFFICER', 'operations.assets.read'),
    ('FINANCE_OFFICER', 'operations.procurement_evidence.manage'),
    ('FINANCE_OFFICER', 'operations.challenge_course.read'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.compliance.read'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.compliance.manage'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.inventory.read'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.inventory.request'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.inventory.manage'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.assets.read'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.assets.checkout'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.assets.manage'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.procurement_evidence.manage'),
    ('ADMIN_FINANCE_ASSISTANT', 'operations.challenge_course.read'),
    ('PROGRAMS_ME_OFFICER', 'operations.inventory.read'),
    ('PROGRAMS_ME_OFFICER', 'operations.inventory.request'),
    ('PROGRAMS_ME_OFFICER', 'operations.assets.read'),
    ('PROGRAMS_ME_OFFICER', 'operations.assets.checkout'),
    ('PROGRAMS_ME_OFFICER', 'operations.challenge_course.read'),
    ('PROGRAMS_ME_OFFICER', 'operations.challenge_course.manage'),
    ('SRHR_OFFICER', 'operations.inventory.read'),
    ('SRHR_OFFICER', 'operations.inventory.request'),
    ('SRHR_OFFICER', 'operations.assets.read'),
    ('SRHR_OFFICER', 'operations.assets.checkout'),
    ('SRHR_OFFICER', 'operations.challenge_course.read'),
    ('MEL_OFFICER', 'operations.compliance.read'),
    ('MEL_OFFICER', 'operations.inventory.read'),
    ('MEL_OFFICER', 'operations.inventory.request'),
    ('MEL_OFFICER', 'operations.challenge_course.read'),
    ('FIELD_OFFICER_1', 'operations.inventory.read'),
    ('FIELD_OFFICER_1', 'operations.inventory.request'),
    ('FIELD_OFFICER_1', 'operations.assets.read'),
    ('FIELD_OFFICER_1', 'operations.challenge_course.read'),
    ('FIELD_OFFICER_2', 'operations.inventory.read'),
    ('FIELD_OFFICER_2', 'operations.inventory.request'),
    ('FIELD_OFFICER_2', 'operations.assets.read'),
    ('FIELD_OFFICER_2', 'operations.challenge_course.read'),
    ('YOUTH_KNOWLEDGE_HUB_OFFICER', 'operations.inventory.read'),
    ('YOUTH_KNOWLEDGE_HUB_OFFICER', 'operations.inventory.request'),
    ('YOUTH_KNOWLEDGE_HUB_OFFICER', 'operations.assets.read'),
    ('YOUTH_KNOWLEDGE_HUB_OFFICER', 'operations.challenge_course.read'),
    ('YOUTH_FACILITATOR_PEER_EDUCATOR', 'operations.challenge_course.read')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS compliance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_type VARCHAR(40) NOT NULL CHECK (record_type IN (
        'tax_clearance',
        'pvo_registration',
        'board_resolution',
        'mou',
        'policy',
        'annual_return',
        'audit_report',
        'legal_document'
    )),
    title TEXT NOT NULL,
    reference_number TEXT,
    issuing_authority TEXT,
    issue_date DATE,
    expiry_date DATE,
    renewal_status VARCHAR(30) NOT NULL DEFAULT 'not_started' CHECK (renewal_status IN (
        'not_started',
        'in_progress',
        'submitted',
        'renewed',
        'expired',
        'not_applicable'
    )),
    compliance_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (compliance_status IN (
        'compliant',
        'pending',
        'at_risk',
        'expired',
        'archived'
    )),
    owner_department TEXT,
    remarks TEXT,
    created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES compliance_records(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    file_name TEXT,
    file_url TEXT,
    uploaded_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    superseded_by_version_id UUID NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'current' CHECK (status IN (
        'draft',
        'current',
        'superseded',
        'archived'
    )),
    effective_date DATE,
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (record_id, version_number)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'compliance_document_versions_superseded_by_fkey'
    ) THEN
        ALTER TABLE compliance_document_versions
            ADD CONSTRAINT compliance_document_versions_superseded_by_fkey
            FOREIGN KEY (superseded_by_version_id) REFERENCES compliance_document_versions(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    unit VARCHAR(40) NOT NULL DEFAULT 'unit',
    minimum_threshold NUMERIC(14, 2) NOT NULL DEFAULT 0,
    operational_threshold NUMERIC(14, 2) NOT NULL DEFAULT 0,
    storage_location TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT NOT NULL UNIQUE DEFAULT ('DN-' || upper(substr(gen_random_uuid()::text, 1, 8))),
    supplier TEXT,
    procurement_request_id UUID REFERENCES procurement_requests(id) ON DELETE SET NULL,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    verified_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    condition_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (condition_status IN (
        'pending',
        'good',
        'damaged',
        'partial',
        'rejected'
    )),
    receiver_signature_url TEXT,
    document_url TEXT,
    remarks TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'rejected', 'archived')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT NOT NULL UNIQUE DEFAULT ('SR-' || upper(substr(gen_random_uuid()::text, 1, 8))),
    title TEXT NOT NULL,
    reason TEXT,
    linked_activity_id INT REFERENCES activities(id) ON DELETE SET NULL,
    district TEXT,
    destination TEXT,
    requested_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN (
        'draft',
        'submitted',
        'reviewed',
        'approved',
        'issued',
        'partially_issued',
        'rejected',
        'cancelled'
    )),
    requested_for_date DATE,
    issued_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity_requested NUMERIC(14, 2) NOT NULL CHECK (quantity_requested > 0),
    quantity_approved NUMERIC(14, 2),
    quantity_issued NUMERIC(14, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    movement_type VARCHAR(40) NOT NULL CHECK (movement_type IN (
        'procurement',
        'donation',
        'return',
        'transfer',
        'activity_distribution',
        'asset_assignment',
        'damage_loss',
        'expiry',
        'challenge_course_usage',
        'reservation',
        'reservation_release',
        'physical_count_adjustment'
    )),
    movement_direction VARCHAR(20) NOT NULL CHECK (movement_direction IN ('in', 'out', 'reserve', 'release')),
    quantity NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
    source TEXT,
    destination TEXT,
    linked_activity_id INT REFERENCES activities(id) ON DELETE SET NULL,
    linked_procurement_id UUID REFERENCES procurement_requests(id) ON DELETE SET NULL,
    stock_request_id UUID REFERENCES stock_requests(id) ON DELETE SET NULL,
    delivery_note_id UUID REFERENCES delivery_notes(id) ON DELETE SET NULL,
    requested_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    movement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    supporting_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE VIEW inventory_item_balances AS
SELECT
    ii.id,
    ii.name,
    ii.category,
    ii.unit,
    ii.minimum_threshold,
    ii.operational_threshold,
    ii.storage_location,
    ii.status,
    COALESCE(SUM(
        CASE
            WHEN sm.movement_direction = 'in' THEN sm.quantity
            WHEN sm.movement_direction = 'out' THEN -sm.quantity
            ELSE 0
        END
    ), 0)::numeric(14, 2) AS current_quantity,
    COALESCE(SUM(
        CASE
            WHEN sm.movement_direction = 'reserve' THEN sm.quantity
            WHEN sm.movement_direction = 'release' THEN -sm.quantity
            ELSE 0
        END
    ), 0)::numeric(14, 2) AS reserved_quantity,
    (
        COALESCE(SUM(
            CASE
                WHEN sm.movement_direction = 'in' THEN sm.quantity
                WHEN sm.movement_direction = 'out' THEN -sm.quantity
                ELSE 0
            END
        ), 0)
        -
        COALESCE(SUM(
            CASE
                WHEN sm.movement_direction = 'reserve' THEN sm.quantity
                WHEN sm.movement_direction = 'release' THEN -sm.quantity
                ELSE 0
            END
        ), 0)
    )::numeric(14, 2) AS available_quantity,
    MAX(sm.movement_date) AS last_movement_at
FROM inventory_items ii
LEFT JOIN stock_movements sm ON sm.item_id = ii.id
GROUP BY
    ii.id,
    ii.name,
    ii.category,
    ii.unit,
    ii.minimum_threshold,
    ii.operational_threshold,
    ii.storage_location,
    ii.status;

CREATE TABLE IF NOT EXISTS procurement_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(40) NOT NULL CHECK (entity_type IN (
        'procurement_request',
        'stock_movement',
        'stock_request',
        'delivery_note',
        'asset_assignment',
        'compliance_record'
    )),
    entity_id TEXT NOT NULL,
    evidence_type VARCHAR(40) NOT NULL CHECK (evidence_type IN (
        'quotation',
        'invoice',
        'receipt',
        'delivery_note',
        'payment_voucher',
        'liquidation_attachment',
        'signed_acknowledgement',
        'photo',
        'other'
    )),
    file_name TEXT,
    file_url TEXT,
    extracted_vendor TEXT,
    extracted_total NUMERIC(14, 2),
    extracted_date DATE,
    uploaded_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code TEXT NOT NULL UNIQUE,
    asset_type VARCHAR(50) NOT NULL DEFAULT 'equipment',
    name TEXT NOT NULL,
    serial_number TEXT,
    purchase_date DATE,
    purchase_value NUMERIC(14, 2),
    condition_status VARCHAR(30) NOT NULL DEFAULT 'good' CHECK (condition_status IN (
        'excellent',
        'good',
        'fair',
        'poor',
        'damaged',
        'lost',
        'disposed'
    )),
    assigned_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    current_location TEXT,
    warranty_expiry DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'available' CHECK (status IN (
        'available',
        'checked_out',
        'maintenance',
        'retired',
        'lost',
        'disposed'
    )),
    qr_code_payload TEXT,
    created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    assigned_to_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    checked_out_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    checkout_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_return_date DATE,
    return_date TIMESTAMP,
    checkout_condition VARCHAR(30) NOT NULL DEFAULT 'good',
    return_condition VARCHAR(30),
    status VARCHAR(30) NOT NULL DEFAULT 'checked_out' CHECK (status IN (
        'requested',
        'approved',
        'checked_out',
        'returned',
        'overdue',
        'closed',
        'cancelled'
    )),
    checkout_signature_url TEXT,
    return_signature_url TEXT,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
    registration_number TEXT NOT NULL UNIQUE,
    insurance_expiry DATE,
    service_due_date DATE,
    mileage NUMERIC(14, 2) NOT NULL DEFAULT 0,
    service_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    fuel_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    driver_assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenge_course_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_code TEXT NOT NULL UNIQUE DEFAULT ('CC-' || upper(substr(gen_random_uuid()::text, 1, 8))),
    title TEXT NOT NULL,
    session_date DATE NOT NULL,
    location TEXT,
    participant_group TEXT,
    participant_count INT NOT NULL DEFAULT 0,
    facilitators JSONB NOT NULL DEFAULT '[]'::jsonb,
    risk_assessment_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (risk_assessment_status IN (
        'pending',
        'completed',
        'approved',
        'rejected'
    )),
    waiver_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (waiver_status IN (
        'pending',
        'partial',
        'complete',
        'not_required'
    )),
    status VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (status IN (
        'planned',
        'approved',
        'in_progress',
        'completed',
        'cancelled'
    )),
    created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenge_course_activity_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    objective TEXT,
    instructions TEXT,
    safety_guide TEXT,
    debrief_guide TEXT,
    equipment_required JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenge_course_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    current_location TEXT,
    condition_status VARCHAR(30) NOT NULL DEFAULT 'good',
    operational_threshold NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'available' CHECK (status IN (
        'available',
        'checked_out',
        'maintenance',
        'retired'
    )),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenge_course_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES challenge_course_sessions(id) ON DELETE SET NULL,
    incident_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    severity VARCHAR(30) NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    participant_name TEXT,
    description TEXT NOT NULL,
    action_taken TEXT,
    reported_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenge_course_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES challenge_course_sessions(id) ON DELETE CASCADE,
    participant_count INT NOT NULL DEFAULT 0,
    confidence_score NUMERIC(5, 2),
    teamwork_score NUMERIC(5, 2),
    leadership_score NUMERIC(5, 2),
    emotional_growth_score NUMERIC(5, 2),
    debrief_notes TEXT,
    recorded_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS confidential_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'audit',
        'disciplinary',
        'safeguarding_escalation',
        'executive_report',
        'legal_issue',
        'donor_investigation',
        'hr_grievance',
        'strategic_plan',
        'board_document',
        'other'
    )),
    title TEXT NOT NULL,
    sensitivity_level VARCHAR(30) NOT NULL DEFAULT 'restricted' CHECK (sensitivity_level IN (
        'restricted',
        'strictly_confidential',
        'board_only'
    )),
    file_name TEXT,
    file_url TEXT,
    view_only BOOLEAN NOT NULL DEFAULT TRUE,
    watermark_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    expiry_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS confidential_document_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES confidential_documents(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(30) NOT NULL DEFAULT 'viewed' CHECK (action IN ('viewed', 'downloaded', 'printed', 'closed')),
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    duration_seconds INT,
    ip_address TEXT,
    user_agent TEXT,
    watermark_text TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_records_type ON compliance_records(record_type);
CREATE INDEX IF NOT EXISTS idx_compliance_records_expiry ON compliance_records(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_date ON stock_movements(item_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_status ON delivery_notes(status);
CREATE INDEX IF NOT EXISTS idx_procurement_evidence_entity ON procurement_evidence(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset_status ON asset_assignments(asset_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicle_profiles_insurance ON vehicle_profiles(insurance_expiry);
CREATE INDEX IF NOT EXISTS idx_challenge_sessions_date ON challenge_course_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_confidential_access_document ON confidential_document_access_logs(document_id, opened_at DESC);

DROP TRIGGER IF EXISTS audit_compliance_records_trigger ON compliance_records;
CREATE TRIGGER audit_compliance_records_trigger
AFTER INSERT OR UPDATE OR DELETE ON compliance_records
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_inventory_items_trigger ON inventory_items;
CREATE TRIGGER audit_inventory_items_trigger
AFTER INSERT OR UPDATE OR DELETE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_stock_movements_trigger ON stock_movements;
CREATE TRIGGER audit_stock_movements_trigger
AFTER INSERT OR UPDATE OR DELETE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_stock_requests_trigger ON stock_requests;
CREATE TRIGGER audit_stock_requests_trigger
AFTER INSERT OR UPDATE OR DELETE ON stock_requests
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_delivery_notes_trigger ON delivery_notes;
CREATE TRIGGER audit_delivery_notes_trigger
AFTER INSERT OR UPDATE OR DELETE ON delivery_notes
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_assets_trigger ON assets;
CREATE TRIGGER audit_assets_trigger
AFTER INSERT OR UPDATE OR DELETE ON assets
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_asset_assignments_trigger ON asset_assignments;
CREATE TRIGGER audit_asset_assignments_trigger
AFTER INSERT OR UPDATE OR DELETE ON asset_assignments
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_challenge_course_sessions_trigger ON challenge_course_sessions;
CREATE TRIGGER audit_challenge_course_sessions_trigger
AFTER INSERT OR UPDATE OR DELETE ON challenge_course_sessions
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');

DROP TRIGGER IF EXISTS audit_confidential_documents_trigger ON confidential_documents;
CREATE TRIGGER audit_confidential_documents_trigger
AFTER INSERT OR UPDATE OR DELETE ON confidential_documents
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn('id');
