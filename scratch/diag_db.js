import { sql } from '../server/api/utils/db.js';

async function check() {
    try {
        const cols = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'volunteer_submissions'
        `;
        console.log('Columns:', JSON.stringify(cols, null, 2));
        
        const constraints = await sql`
            SELECT conname, pg_get_constraintdef(oid) 
            FROM pg_constraint 
            WHERE conrelid = 'notifications'::regclass 
            AND contype = 'c'
        `;
        console.log('Notification Constraints:', JSON.stringify(constraints, null, 2));

        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = current_schema()
        `;
        console.log('Tables:', JSON.stringify(tables, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
