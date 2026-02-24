# Database Reset Instructions

## Step 1: Clear All Data

1. Go to your Supabase dashboard: <https://supabase.com/dashboard>
2. Select your MMPZ project
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Copy the contents of `database/clear_database.sql`
6. Paste into the SQL editor
7. Click **Run** or press `Ctrl+Enter`
8. You should see a table showing all counts as 0

## Step 2: Create Fresh Admin Account

1. In the same SQL Editor, create a new query
2. Copy the contents of `database/create_admin.sql`
3. Paste into the SQL editor
4. Click **Run**
5. You should see confirmation that 1 row was inserted

## Step 3: Verify and Login

1. Go to **Table Editor** → **users**
2. You should see one admin user
3. Go to your deployed site: <https://mmpzmonitoring.netlify.app>
4. Login with:
   - Email: `admin@mmpz.org`
   - Password: `admin123`

## Step 4: Change Password (Recommended)

After logging in:

1. Go to User Management (admin only)
2. Create a new admin user with a strong password
3. Logout and login with the new account
4. Delete the temporary admin account

## Alternative: Custom Admin Account

If you want to use different credentials, edit `create_admin.sql` and change:

- `name`: Your preferred admin name
- `email`: Your preferred email
- `password_hash`: Your preferred password (plaintext for now)

Then run the modified script in Supabase.

## Notes

- The password is stored as plaintext for initial setup
- The login function handles both plaintext and bcrypt hashes
- For production, you should use bcrypt-hashed passwords
- You can add more users through the admin panel after logging in
