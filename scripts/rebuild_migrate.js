import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const canonicalSchemaFile = path.resolve(__dirname, '../database/schema.sql');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

const run = async () => {
    try {
        if (!fs.existsSync(canonicalSchemaFile)) {
            throw new Error(`Canonical schema file not found: ${canonicalSchemaFile}`);
        }

        const sqlContent = fs.readFileSync(canonicalSchemaFile, 'utf8');
        console.log('Applying canonical ERP schema...');

        await sql.begin(async (tx) => {
            await tx.unsafe(sqlContent);
        });

        console.log('Canonical schema applied successfully.');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
};

run();
