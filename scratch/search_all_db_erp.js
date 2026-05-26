import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = 'postgresql://mmpz:mmpz@localhost:5432/mmpz_compass';
const sql = postgres(databaseUrl);

async function run() {
    try {
        console.log('Searching all tables in erp for Dumolwenkosi...');
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `;

        for (const t of tables) {
            const table_name = t.table_name;
            const columns = await sql`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = ${table_name}
            `;
            
            const textColumns = columns
                .filter(c => c.data_type === 'text' || c.data_type === 'character varying')
                .map(c => c.column_name);
                
            if (textColumns.length === 0) continue;
            
            // Construct a dynamic query
            const conditions = textColumns.map(c => `"${c}" iLIKE '%Dumolwenkosi%'`).join(' OR ');
            const queryStr = `SELECT * FROM "${table_name}" WHERE ${conditions}`;
            
            try {
                const results = await sql.unsafe(queryStr);
                if (results.length > 0) {
                    console.log(`Found in table "${table_name}":`);
                    console.log(JSON.stringify(results, null, 2));
                }
            } catch (err) {
                // Ignore query errors for specific system/view tables
            }
        }
        process.exit(0);
    } catch (err) {
        console.error('Failure:', err);
        process.exit(1);
    }
}

run();
