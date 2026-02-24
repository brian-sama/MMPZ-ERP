-- Clear All Data from MMPZ Database
-- Run this in Supabase SQL Editor to start fresh

-- Delete all data (in correct order due to foreign keys)
DELETE FROM kobo_submissions;
DELETE FROM kobo_form_links;
DELETE FROM kobo_config;
DELETE FROM notifications;
DELETE FROM activities;
DELETE FROM progress_updates;
DELETE FROM indicators;
DELETE FROM users;

-- Reset sequences (optional - starts IDs from 1 again)
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE indicators_id_seq RESTART WITH 1;
ALTER SEQUENCE progress_updates_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE activities_id_seq RESTART WITH 1;
ALTER SEQUENCE kobo_config_id_seq RESTART WITH 1;
ALTER SEQUENCE kobo_form_links_id_seq RESTART WITH 1;
ALTER SEQUENCE kobo_submissions_id_seq RESTART WITH 1;

-- Verify all tables are empty
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'indicators', COUNT(*) FROM indicators
UNION ALL
SELECT 'progress_updates', COUNT(*) FROM progress_updates
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'activities', COUNT(*) FROM activities
UNION ALL
SELECT 'kobo_config', COUNT(*) FROM kobo_config
UNION ALL
SELECT 'kobo_form_links', COUNT(*) FROM kobo_form_links
UNION ALL
SELECT 'kobo_submissions', COUNT(*) FROM kobo_submissions;
