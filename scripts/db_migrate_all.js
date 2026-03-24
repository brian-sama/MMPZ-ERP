import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaFile = path.resolve(__dirname, '../database/schema.sql');
const migrationsDir = path.resolve(__dirname, '../database/migrations');
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

const run = async () => {
    try {
        await ensureMigrationTable();

        // 1. Run Schema if changed
        if (fs.existsSync(schemaFile)) {
            const schemaContent = fs.readFileSync(schemaFile, 'utf8');
            // For schema.sql, we just run it safely or assume it's idempotent (CREATE IF NOT EXISTS)
            console.log('Synchronizing base schema...');
            await sql.unsafe(schemaContent);
        }

        // 2. Run JS Migrations
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir)
                .filter(f => f.endsWith('.js'))
                .sort();

            for (const file of files) {
                const executed = await sql`
                    SELECT id FROM schema_migrations WHERE filename = ${file}
                `;

                if (executed.length === 0) {
                    console.log(`Running migration: ${file}`);
                    const migrationPath = path.join(migrationsDir, file);
                    const { handler } = await import(`file://${migrationPath}`);
                    
                    if (typeof handler === 'function') {
                        await handler(sql);
                        await sql`
                            INSERT INTO schema_migrations (filename, checksum)
                            VALUES (${file}, 'js-migration')
                        `;
                        console.log(`Migration ${file} completed.`);
                    } else {
                        console.warn(`Migration ${file} missing export const handler = async (sql) => { ... }`);
                    }
                } else {
                    // console.log(`Skipping ${file} (already executed)`);
                }
            }
        }

        console.log('All migrations completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
};

run();
