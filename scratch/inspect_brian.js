import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://mmpz:mmpz@localhost:5432/mmpz_erp_local?sslmode=disable';
const sql = postgres(databaseUrl);

async function run() {
    try {
        console.log('Querying Brian users...');
        const users = await sql`
            SELECT * 
            FROM users
            WHERE email LIKE '%brian%' OR name LIKE '%Brian%'
        `;
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Failure:', err);
        process.exit(1);
    }
}

run();
