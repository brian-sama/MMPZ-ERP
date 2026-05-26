import postgres from 'postgres';

const databaseUrl = 'postgresql://mmpz:mmpz@localhost:5432/mmpz_compass';
const sql = postgres(databaseUrl);

async function run() {
    try {
        console.log('Querying compass users...');
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `;
        console.log('Tables in compass:', tables.map(t => t.table_name).join(', '));

        const users = await sql`
            SELECT * 
            FROM "User"
        `;
        console.log('Users in User table:');
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Failure:', err);
        process.exit(1);
    }
}

run();
