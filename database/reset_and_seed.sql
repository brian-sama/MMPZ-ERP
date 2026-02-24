-- MMPZ Database Reset and Seed Script
-- This script clears ALL data and recreates it fresh

-- Step 1: Truncate all tables with CASCADE to handle foreign keys
TRUNCATE TABLE kobo_submissions CASCADE;
TRUNCATE TABLE kobo_form_links CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE activities CASCADE;
TRUNCATE TABLE progress_updates CASCADE;
TRUNCATE TABLE indicators CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE kobo_config CASCADE;

-- Step 2: Reset sequences to start from 1
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE indicators_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE activities_id_seq RESTART WITH 1;
ALTER SEQUENCE progress_updates_id_seq RESTART WITH 1;
ALTER SEQUENCE kobo_config_id_seq RESTART WITH 1;
ALTER SEQUENCE kobo_form_links_id_seq RESTART WITH 1;
ALTER SEQUENCE kobo_submissions_id_seq RESTART WITH 1;

-- Step 3: Insert fresh admin account
INSERT INTO users (name, email, role, password_hash) VALUES 
('System Admin', 'brianmagagula5@gmail.com', 'admin', E'Brian7350$@#');

-- Step 4: Insert other test users
INSERT INTO users (name, email, role, password_hash) VALUES 
('Director Sarah', 'sarah@mmpz.org', 'director', 'director123'),
('Officer Tinashe', 'tinashe@mmpz.org', 'officer', 'officer123'),
('Intern Mandla', 'mandla@mmpz.org', 'intern', 'intern123');

-- Step 5: Insert sample indicators
INSERT INTO indicators (title, target_value, current_value, total_budget, current_budget_balance, created_by_user_id, priority)
VALUES 
('Digital Literacy Campaign', 500, 125, 2000.00, 1500.00, 1, 'high'),
('Youth Empowerment Workshop', 200, 50, 1500.00, 1200.00, 1, 'medium'),
('Community Outreach Program', 1000, 300, 5000.00, 4000.00, 1, 'critical');

-- Step 6: Insert sample notifications
INSERT INTO notifications (user_id, type, title, message, related_indicator_id) VALUES
(1, 'system', 'Welcome to MMPZ', 'Your M&E system is now set up and ready to use.', NULL),
(2, 'approval_needed', 'Progress Update Pending', 'A progress update for Digital Literacy Campaign needs your approval.', 1);

-- Step 7: Initialize Kobo config
INSERT INTO kobo_config (server_url, api_token, is_connected) VALUES 
('https://kf.kobotoolbox.org', '', FALSE);

-- Step 8: Verify data was created
SELECT '=== USERS ===' as section;
SELECT id, name, email, role FROM users ORDER BY id;

SELECT '=== INDICATORS ===' as section;
SELECT id, title, created_by_user_id FROM indicators ORDER BY id;

SELECT '=== NOTIFICATIONS ===' as section;
SELECT id, user_id, type, title FROM notifications ORDER BY id;

SELECT '=== KOBO CONFIG ===' as section;
SELECT server_url, is_connected FROM kobo_config;
