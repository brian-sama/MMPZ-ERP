-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Disable RLS for all tables to allow the app to work
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE indicators DISABLE ROW LEVEL SECURITY;
ALTER TABLE progress_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE kobo_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE kobo_form_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE kobo_submissions DISABLE ROW LEVEL SECURITY;

-- 2. Ensure IDs start from where they should (if you deleted rows)
-- SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
