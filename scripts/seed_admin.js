import 'dotenv/config';
import postgres from 'postgres';
import { hashPassword } from '../server/api/utils/auth.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
}

const sql = postgres(databaseUrl);

async function seedAdmin() {
    const name = 'Brian Magagula';
    const email = 'brianmagagula5@gmail.com';
    const password = 'Brian7350$@#';
    const roleCode = 'DIRECTOR';
    const systemRole = 'SUPER_ADMIN';
    const jobTitle = 'System Administrator / Director';
    const roleLegacySnapshot = 'director';

    try {
        console.log(`Checking if user ${email} exists...`);
        const existing = await sql`SELECT id FROM users WHERE email = ${email}`;

        const password_hash = await hashPassword(password);

        if (existing.length > 0) {
            console.log(`User ${email} already exists. Updating password and role to Director...`);
            await sql`
                UPDATE users
                SET
                    password_hash = ${password_hash},
                    role_code = ${roleCode},
                    system_role = ${systemRole},
                    job_title = ${jobTitle},
                    role_assignment_status = 'confirmed',
                    role_confirmed_at = CURRENT_TIMESTAMP,
                    role_legacy_snapshot = ${roleLegacySnapshot},
                    require_password_reset = false
                WHERE email = ${email}
            `;
            console.log('Super admin account updated successfully.');
        } else {
            console.log(`Creating admin account ${email}...`);
            await sql`
                INSERT INTO users (
                    name,
                    email,
                    password_hash,
                    role_code,
                    system_role,
                    job_title,
                    role_assignment_status,
                    role_confirmed_at,
                    role_legacy_snapshot,
                    require_password_reset
                )
                VALUES (
                    ${name},
                    ${email},
                    ${password_hash},
                    ${roleCode},
                    ${systemRole},
                    ${jobTitle},
                    'confirmed',
                    CURRENT_TIMESTAMP,
                    ${roleLegacySnapshot},
                    false
                )
            `;
            console.log('Super admin account created successfully.');
        }
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
}

seedAdmin();
