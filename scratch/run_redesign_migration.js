import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { sql } from '../server/api/utils/db.js';

async function runMigration() {
    try {
        const migrationPath = path.join(process.cwd(), 'database', 'migrations', '20260501_redesign.sql');
        console.log(`Reading migration from: ${migrationPath}`);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing migration...');
        // unsafe is used here because we are running a raw SQL file with multiple commands
        await sql.unsafe(migrationSql);
        
        console.log('Migration COMPLETED successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration FAILED:', err);
        process.exit(1);
    }
}

runMigration();
