import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedFile = path.resolve(__dirname, '../database/seed.sql');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

const run = async () => {
    try {
        if (!fs.existsSync(seedFile)) {
            throw new Error(`Seed file not found: ${seedFile}`);
        }

        const seedSql = fs.readFileSync(seedFile, 'utf8');
        console.log('Applying seed data from database/seed.sql ...');
        await sql.begin(async (tx) => {
            await tx.unsafe(seedSql);
        });
        console.log('Seed data applied successfully.');
    } catch (error) {
        console.error('Seed failed:', error.message);
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
};

run();
