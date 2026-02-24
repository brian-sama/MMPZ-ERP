-- Fix Supabase Permissions for MMPZ System
-- Run this in Supabase SQL Editor to allow the anon key to access tables

-- CRITICAL: Disable Row Level Security (RLS) on all tables
-- This allows the anon key (used by Netlify Functions) to access data

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE indicators DISABLE ROW LEVEL SECURITY;
ALTER TABLE progress_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE kobo_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE kobo_form_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE kobo_submissions DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- The rowsecurity column should show 'f' (false) for all tables
