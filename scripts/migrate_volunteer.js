
// Script to run database migrations
import 'dotenv/config'; // Load .env file
import { sql } from '../netlify/functions/utils/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
    try {
        const migrationFile = path.resolve(__dirname, '../database/volunteer_migration.sql');
        console.log(`Reading migration file from: ${migrationFile}`);

        const migrationSql = fs.readFileSync(migrationFile, 'utf8');
        console.log('Executing migration...');

        // Split by semicolon to run multiple statements if needed, 
        // but postgres-js might handle it. Best to run as single sql`...` if it supports it, 
        // or split. The neon 'sql' tag usually handles multiple statements.
        // However, safe bet is to use the raw query.

        await sql.unsafe(migrationSql);

        console.log('✅ Migration executed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
