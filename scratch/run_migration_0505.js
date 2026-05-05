import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function runMigration() {
    try {
        const migrationPath = 'database/migrations/20260505_leave_and_signatures.sql';
        console.log(`Running migration: ${migrationPath}`);
        const sqlContent = fs.readFileSync(migrationPath, 'utf8');
        
        // Split by semicolon and filter out empty lines to run each command
        // Note: this is a simple splitter, might fail on complex SQL but for this it's fine
        const commands = sqlContent.split(';').map(c => c.trim()).filter(c => c.length > 0);
        
        for (const cmd of commands) {
            console.log(`Executing: ${cmd.substring(0, 50)}...`);
            await sql.unsafe(cmd);
        }
        
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sql.end();
    }
}

runMigration();
