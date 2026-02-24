# URGENT FIX: Database Permissions Issue

## Problem

Creating indicators and users is failing because **Supabase Row Level Security (RLS)** is blocking the API requests.

## Solution

Run the SQL script to disable RLS on all tables.

### Steps to Fix

1. **Go to Supabase Dashboard**
   - <https://supabase.com/dashboard>
   - Select your MMPZ project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run This SQL:**

   ```sql
   -- Disable Row Level Security on all tables
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   ALTER TABLE indicators DISABLE ROW LEVEL SECURITY;
   ALTER TABLE progress_updates DISABLE ROW LEVEL SECURITY;
   ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
   ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
   ALTER TABLE kobo_config DISABLE ROW LEVEL SECURITY;
   ALTER TABLE kobo_form_links DISABLE ROW LEVEL SECURITY;
   ALTER TABLE kobo_submissions DISABLE ROW LEVEL SECURITY;
   ```

4. **Click "Run"** or press `Ctrl+Enter`

5. **Verify it worked:**

   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public'
   ORDER BY tablename;
   ```

   All tables should show `rowsecurity = f` (false)

6. **Test the app:**
   - Go to <https://mmpzmonitoring.netlify.app>
   - Login
   - Try creating an indicator
   - Try creating a user
   - Both should work now!

## Why This Happened

Supabase enables Row Level Security (RLS) by default on new tables. RLS requires authentication policies to allow access. Since we're using the `anon` key from Netlify Functions (not authenticated users), RLS blocks all requests.

## Alternative: Enable RLS with Policies (More Secure)

If you want to keep RLS enabled for security, you can create policies instead:

```sql
-- Enable RLS
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for anon key
CREATE POLICY "Allow all for anon" ON indicators
FOR ALL
TO anon
USING (true)
WITH CHECK (true);
```

But for now, **disabling RLS is the quickest fix** to get your app working.

## After Running the Fix

Your app should work perfectly:

- ✅ Create indicators
- ✅ Create users
- ✅ Create activities
- ✅ All CRUD operations
- ✅ KoboToolbox integration

Run the SQL script now and test!
