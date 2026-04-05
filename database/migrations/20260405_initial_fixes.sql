-- Migration: Add SYSTEM_ADMIN role and phone number support
-- Date: 2026-04-05

-- 1. Add SYSTEM_ADMIN to roles table
INSERT INTO roles (code, name, description, is_executive)
VALUES ('SYSTEM_ADMIN', 'System Administrator', 'Highest level of administrative access and control.', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 2. Ensure SYSTEM_ADMIN has all permissions
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'SYSTEM_ADMIN', code FROM permissions
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 3. Add phone column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- 4. Update specific user brianmagagula5@gmail.com
UPDATE users
SET 
    role_code = 'SYSTEM_ADMIN',
    system_role = 'SUPER_ADMIN',
    job_title = 'Development Facilitator',
    role_assignment_status = 'confirmed',
    role_confirmed_at = CURRENT_TIMESTAMP
WHERE email = 'brianmagagula5@gmail.com';
