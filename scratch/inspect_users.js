import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://mmpz:mmpz@localhost:5432/mmpz_erp_local?sslmode=disable';
const sql = postgres(databaseUrl);

async function run() {
    try {
        console.log('Querying users...');
        const users = await sql`
            SELECT id, name, email, role_code, system_role, role_assignment_status, created_at 
            FROM users
        `;
        console.log('Users found:');
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Failure:', err);
        process.exit(1);
    }
}

run();
