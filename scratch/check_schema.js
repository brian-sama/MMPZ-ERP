import { sql } from '../server/api/utils/db.js';

async function checkSchema() {
    try {
        console.log('Checking indicators table:');
        const indicators = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'indicators'
        `;
        console.table(indicators);

        console.log('\nChecking volunteer_submissions table:');
        const submissions = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'volunteer_submissions'
        `;
        console.table(submissions);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
