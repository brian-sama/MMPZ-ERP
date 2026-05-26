import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://mmpz:mmpz@localhost:5432/mmpz_erp_local?sslmode=disable';
const sql = postgres(databaseUrl);

async function run() {
    try {
        console.log('Querying development_facilitators table in erp...');
        const result = await sql`
            SELECT df.*, u.name as user_name, u.email as user_email
            FROM development_facilitators df
            JOIN users u ON u.id = df.user_id
        `;
        console.log(JSON.stringify(result, null, 2));

        console.log('Querying facilitators table in erp...');
        const result2 = await sql`
            SELECT f.*, u.name as user_name, u.email as user_email
            FROM facilitators f
            JOIN users u ON u.id = f.user_id
        `;
        console.log(JSON.stringify(result2, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Failure:', err);
        process.exit(1);
    }
}

run();
