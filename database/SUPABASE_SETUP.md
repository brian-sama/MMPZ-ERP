# Supabase Setup Instructions

## Step 1: Create Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. Verify your email if needed

## Step 2: Create New Project

1. Click "New Project"
2. Fill in project details:
   - **Name**: `mmpz-system` (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your location
   - **Pricing Plan**: Free tier (perfect for MMPZ)
3. Click "Create new project"
4. Wait 2-3 minutes for setup to complete

## Step 3: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click "New query"
3. Copy the entire contents of `database/schema.sql`
4. Paste into the SQL editor
5. Click "Run" or press `Ctrl+Enter`
6. Verify: You should see "Success. No rows returned"

## Step 4: Run Seed Data (Optional)

1. In SQL Editor, create another new query
2. Copy contents of `database/seed.sql`
3. Paste and run
4. Verify: Check the **Table Editor** to see sample data

## Step 5: Get Connection Credentials

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **API** section
3. Copy these values (you'll need them later):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (long string)

## Step 6: Test Connection

1. Go to **Table Editor**
2. Click on `users` table
3. You should see 4 sample users
4. Click on `indicators` table
5. You should see 3 sample indicators

## Next Steps

Once Supabase is set up:

1. Save your Project URL and anon key
2. We'll use these in Netlify Functions
3. Continue with backend migration

## Important Notes

- **Database Password**: Only needed for direct database access (not for API)
- **Anon Key**: Safe to use in frontend/functions (has Row Level Security)
- **Service Role Key**: Keep secret! Only use in backend if needed
- **Free Tier Limits**: 500MB database, unlimited API requests (perfect for MMPZ)

## Troubleshooting

**Schema fails to run?**

- Make sure you're running the entire schema at once
- Check for any error messages
- Ensure you're in the SQL Editor, not Table Editor

**Can't see tables?**

- Refresh the page
- Check Table Editor in left sidebar
- Verify schema ran successfully

**Need help?**

- Supabase docs: <https://supabase.com/docs>
- Let me know and I'll assist!
