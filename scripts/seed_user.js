import 'dotenv/config';
import { sql } from '../server/api/utils/db.js';
import { hashPassword } from '../server/api/utils/auth.js';

async function seedUser() {
    const email = 'brianmagagula5@gmail.com';
    const role_code = 'DIRECTOR';
    const system_role = 'SUPER_ADMIN';
    const name = 'Brian Magagula';
    const job_title = 'System Administrator / Director';
    const role_legacy_snapshot = 'director';
    const initial_password = 'Password123!';
    const password_hash = await hashPassword(initial_password);

    console.log(`Seeding user ${email}...`);

    try {
        const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;

        if (existing.length > 0) {
            console.log(`Updating existing user ${email}...`);
            await sql`
                UPDATE users
                SET
                    password_hash = ${password_hash},
                    role_code = ${role_code},
                    system_role = ${system_role},
                    job_title = ${job_title},
                    role_assignment_status = 'confirmed',
                    role_confirmed_at = CURRENT_TIMESTAMP,
                    role_legacy_snapshot = ${role_legacy_snapshot},
                    require_password_reset = true
                WHERE email = ${email}
            `;
            console.log('Update complete. Temporary password reset to: Password123!');
        } else {
            console.log(`Creating new user ${email}...`);
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
                    ${role_code},
                    ${system_role},
                    ${job_title},
                    'confirmed',
                    CURRENT_TIMESTAMP,
                    ${role_legacy_snapshot},
                    true
                )
            `;
            console.log('Creation complete. Temporary password set to: Password123!');
        }
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
}

seedUser();
