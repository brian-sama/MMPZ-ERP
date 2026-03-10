import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
const sql = postgres(databaseUrl);

async function inspect() {
    try {
        console.log('Inspecting Tables...');
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `;
        console.log('Tables:', tables.map(t => t.table_name).join(', '));

        for (const t of tables) {
            const table_name = t.table_name;
            const columns = await sql`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = ${table_name}
            `;
            console.log(`\nTable: ${table_name}`);
            columns.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
        }

        process.exit(0);
    } catch (err) {
        console.error('INSPECTION FAILURE:', err);
        process.exit(1);
    }
}

inspect();
