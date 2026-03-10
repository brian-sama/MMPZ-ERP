import postgres from 'postgres';
import dotenv from 'dotenv';
import { spawnSync } from 'child_process';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

const runNodeScript = (scriptPath) => {
    const result = spawnSync('node', [scriptPath], { stdio: 'inherit', shell: true });
    if (result.status !== 0) {
        throw new Error(`Script failed: ${scriptPath}`);
    }
};

const reset = async () => {
    try {
        console.log('Dropping and recreating public schema...');
        await sql`DROP SCHEMA IF EXISTS public CASCADE`;
        await sql`CREATE SCHEMA public`;
        await sql`GRANT ALL ON SCHEMA public TO public`;
        await sql`GRANT ALL ON SCHEMA public TO CURRENT_USER`;
        console.log('Schema reset complete.');
    } catch (error) {
        console.error('Database reset failed:', error.message);
        process.exitCode = 1;
        await sql.end();
        return;
    }

    await sql.end();

    try {
        runNodeScript('scripts/db_migrate.js');
        runNodeScript('scripts/db_seed.js');
        console.log('Database reset, migration, and seed complete.');
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
};

reset();
