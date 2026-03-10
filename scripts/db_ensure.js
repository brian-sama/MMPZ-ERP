import 'dotenv/config';
import { spawnSync } from 'child_process';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const canConnect = async (url, timeoutSeconds = 3) => {
    const sql = postgres(url, { max: 1, connect_timeout: timeoutSeconds });
    try {
        await sql`SELECT 1`;
        return true;
    } catch {
        return false;
    } finally {
        await sql.end({ timeout: 1 });
    }
};

const ensureDatabase = async () => {
    const reachable = await canConnect(databaseUrl);
    if (reachable) {
        console.log('Database is already reachable. Skipping Docker startup.');
        return;
    }

    console.log('Database not reachable. Attempting Docker Compose startup...');
    const up = spawnSync(process.execPath, ['scripts/docker_compose.js', 'up', '-d'], {
        stdio: 'inherit',
    });
    if (up.status !== 0) {
        console.error('Failed to start PostgreSQL via Docker Compose.');
        process.exit(up.status ?? 1);
    }

    const maxAttempts = 30;
    for (let i = 1; i <= maxAttempts; i += 1) {
        const ok = await canConnect(databaseUrl, 2);
        if (ok) {
            console.log('Database is ready.');
            return;
        }
        await delay(1000);
    }

    console.error('Database did not become ready in time.');
    process.exit(1);
};

ensureDatabase();

