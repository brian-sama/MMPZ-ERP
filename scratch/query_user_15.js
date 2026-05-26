import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
const sql = postgres(databaseUrl);

async function run() {
    try {
        const rows = await sql`
            SELECT DISTINCT role_code, system_role 
            FROM users
        `;
        console.log('DISTINCT ROLES IN DB:', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('QUERY FAILED:', err);
        process.exit(1);
    }
}

run();
