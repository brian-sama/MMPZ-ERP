import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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

const sha256 = (content) =>
    crypto.createHash('sha256').update(content).digest('hex');

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

        // 2. Run Migrations (.js and .sql)
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir)
                .filter(f => f.endsWith('.js') || f.endsWith('.sql'))
                .sort();

            for (const file of files) {
                const migrationPath = path.join(migrationsDir, file);
                const rawContent = fs.readFileSync(migrationPath, 'utf8');
                const lfNormalizedContent = rawContent.replace(/\r\n/g, '\n');
                
                const rawChecksum = sha256(rawContent);
                const lfChecksum = sha256(lfNormalizedContent);
                const migrationChecksum = lfChecksum; // Use LF normalized as standard

                const executed = await sql`
                    SELECT checksum FROM schema_migrations WHERE filename = ${file}
                `;

                if (
                    executed.length > 0 &&
                    ['js-migration', 'sql-migration'].includes(executed[0].checksum)
                ) {
                    await sql`
                        UPDATE schema_migrations
                        SET checksum = ${migrationChecksum}
                        WHERE filename = ${file}
                    `;
                    executed[0].checksum = migrationChecksum;
                }

                if (executed.length > 0) {
                    const dbChecksum = executed[0].checksum;
                    if (dbChecksum !== rawChecksum && dbChecksum !== lfChecksum) {
                        if (process.env.SKIP_MIGRATION_CHECKSUM_VALIDATION === 'true') {
                            console.warn(`⚠️ Warning: Applied migration was modified after execution: ${file}. Skipping validation as SKIP_MIGRATION_CHECKSUM_VALIDATION is true.`);
                            // Optionally update db to match new checksum
                            await sql`
                                UPDATE schema_migrations
                                SET checksum = ${lfChecksum}
                                WHERE filename = ${file}
                            `;
                        } else {
                            throw new Error(
                                `Applied migration was modified after execution: ${file}\n` +
                                `  Database checksum: ${dbChecksum}\n` +
                                `  File checksum (LF normalized): ${lfChecksum}\n` +
                                `  File checksum (Raw): ${rawChecksum}\n` +
                                `To bypass this check, set SKIP_MIGRATION_CHECKSUM_VALIDATION=true in your environment variables.`
                            );
                        }
                    }
                }

                if (executed.length === 0) {
                    console.log(`Running migration: ${file}`);
                    
                    if (file.endsWith('.js')) {
                        const { handler } = await import(`file://${migrationPath}`);
                        if (typeof handler === 'function') {
                            await handler(sql);
                        } else {
                            throw new Error(`Migration ${file} missing export const handler = async (sql) => { ... }`);
                        }
                    } else if (file.endsWith('.sql')) {
                        await sql.unsafe(rawContent);
                    }

                    await sql`
                        INSERT INTO schema_migrations (filename, checksum)
                        VALUES (${file}, ${migrationChecksum})
                    `;
                    console.log(`Migration ${file} completed.`);
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
