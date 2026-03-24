import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

// Using object config to avoid URL encoding issues with special characters in password
const sql = postgres({
    host: 'localhost',
    port: 5432,
    database: 'mmpz_erp_local',
    username: 'postgres',
    password: 'Brian7350$@#',
    ssl: false
});

async function migrate() {
    console.log('Running RBAC migration (v2)...');
    try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS system_role TEXT;`;
        
        const mapping = {
            'DIRECTOR': 'MANAGEMENT',
            'FINANCE_ADMIN_OFFICER': 'PROGRAM_STAFF',
            'ADMIN_ASSISTANT': 'OPERATIONS',
            'LOGISTICS_ASSISTANT': 'OPERATIONS',
            'PSYCHOSOCIAL_SUPPORT_OFFICER': 'PROGRAM_STAFF',
            'COMMUNITY_DEVELOPMENT_OFFICER': 'PROGRAM_STAFF',
            'ME_INTERN_ACTING_OFFICER': 'INTERN',
            'SOCIAL_SERVICES_INTERN': 'INTERN',
            'YOUTH_COMMUNICATIONS_INTERN': 'INTERN',
            'DEVELOPMENT_FACILITATOR': 'FACILITATOR',
            'SYSTEM_ADMIN': 'SUPER_ADMIN'
        };

        const users = await sql`SELECT id, role_code, name FROM users`;
        for (const user of users) {
            const systemRole = mapping[user.role_code] || 'INTERN';
            await sql`
                UPDATE users 
                SET 
                    system_role = ${systemRole},
                    job_title = role_code 
                WHERE id = ${user.id}
            `;
            console.log(`Updated ${user.name} (ID: ${user.id}) to ${systemRole}`);
        }

        console.log('Migration complete.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sql.end();
    }
}

migrate();
