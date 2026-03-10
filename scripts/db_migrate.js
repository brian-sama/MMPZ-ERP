import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaFile = path.resolve(__dirname, '../database/schema.sql');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

const ensureMigrationTable = async () => {
    await sql`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            filename TEXT NOT NULL UNIQUE,
            checksum TEXT NOT NULL,
            executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;
};

const checksum = (content) => {
    let hash = 0;
    for (let i = 0; i < content.length; i += 1) {
        hash = ((hash << 5) - hash) + content.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
};

const run = async () => {
    try {
        if (!fs.existsSync(schemaFile)) {
            throw new Error(`Schema file not found: ${schemaFile}`);
        }

        await ensureMigrationTable();
        const sqlContent = fs.readFileSync(schemaFile, 'utf8');
        const hash = checksum(sqlContent);
        const filename = 'database/schema.sql';

        console.log(`Applying schema: ${filename}`);
        await sql.begin(async (tx) => {
            await tx.unsafe(sqlContent);
            await tx`
                INSERT INTO schema_migrations (filename, checksum)
                VALUES (${filename}, ${hash})
                ON CONFLICT (filename)
                DO UPDATE SET checksum = EXCLUDED.checksum, executed_at = CURRENT_TIMESTAMP
            `;
        });

        console.log('Schema applied successfully.');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
};

run();
