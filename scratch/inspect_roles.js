import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://mmpz:mmpz@localhost:5432/mmpz_erp_local?sslmode=disable';
const sql = postgres(databaseUrl);

async function run() {
    try {
        console.log('Querying roles table...');
        const roles = await sql`
            SELECT * FROM roles
        `;
        console.log(JSON.stringify(roles, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Failure:', err);
        process.exit(1);
    }
}

run();
