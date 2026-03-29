import { sql } from '../server/api/utils/db.js';
import { hashPassword } from '../server/api/utils/auth.js';

async function seedUser() {
    const email = 'brianmagagula5@gmail.com';
    const role_code = 'DEVELOPMENT_FACILITATOR';
    const system_role = 'SUPER_ADMIN';
    const name = 'Brian Magagula';
    const job_title = 'System Administrator / Facilitator';
    const initial_password = 'Password123!'; // Default password for new seed
    const password_hash = await hashPassword(initial_password);

    console.log(`Seeding user ${email}...`);

    try {
        const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
        
        if (existing.length > 0) {
            console.log(`Updating existing user ${email}...`);
            await sql`
                UPDATE users 
                SET 
                    role_code = ${role_code}, 
                    system_role = ${system_role},
                    job_title = ${job_title},
                    require_password_reset = true
                WHERE email = ${email}
            `;
            console.log('Update complete.');
        } else {
            console.log(`Creating new user ${email}...`);
            await sql`
                INSERT INTO users (name, email, password_hash, role_code, system_role, job_title, require_password_reset)
                VALUES (${name}, ${email}, ${password_hash}, ${role_code}, ${system_role}, ${job_title}, true)
            `;
            console.log('Creation complete. Temporary password set to: Password123!');
        }
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        process.exit(0);
    }
}

seedUser();
