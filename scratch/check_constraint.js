import { sql } from '../server/api/utils/db.js';

async function check() {
    try {
        const rows = await sql`
            SELECT pg_get_constraintdef(oid) as definition
            FROM pg_constraint 
            WHERE conname = 'volunteer_submissions_type_check'
        `;
        console.log('Constraint Definition:', rows[0]?.definition);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
