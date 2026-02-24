-- Create Fresh Admin Account
-- Run this AFTER clearing the database

-- Delete existing admin if present
DELETE FROM users WHERE email = 'brianmagagula5@gmail.com';

-- Insert admin user with plaintext password for initial setup
-- Password: Brian7350$@#
-- The login function handles plaintext comparison for backward compatibility
-- You can change the password after first login
INSERT INTO users (name, email, role, password_hash) VALUES 
('System Administrator', 'brianmagagula5@gmail.com', 'admin', 'Brian7350$@#');

-- Initialize empty Kobo config
INSERT INTO kobo_config (server_url, api_token, is_connected) VALUES 
('https://kf.kobotoolbox.org', '', FALSE);

-- Verify admin user was created
SELECT id, name, email, role, created_at FROM users WHERE role = 'admin';
