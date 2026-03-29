import postgres from 'postgres';

export const handler = async (event) => {
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    const provider = hasDatabaseUrl
        ? (process.env.DATABASE_URL.includes('localhost') ? 'Local PostgreSQL' : 'PostgreSQL')
        : 'Not configured';
    let database = {
        configured: hasDatabaseUrl,
        reachable: false,
    };

    if (hasDatabaseUrl) {
        const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 5 });
        try {
            await sql`SELECT 1`;
            database = {
                ...database,
                reachable: true,
            };
        } catch (error) {
            database = {
                ...database,
                reachable: false,
                error: error.message,
            };
        } finally {
            await sql.end();
        }
    }

    const statusCode = database.configured && !database.reachable ? 503 : 200;

    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
            status: statusCode === 200 ? 'ok' : 'degraded',
            message: statusCode === 200 ? 'MMPZ API is running' : 'MMPZ API is up but dependencies are not ready',
            timestamp: new Date().toISOString(),
            env: {
                hasDatabaseUrl,
                provider,
            },
            database,
        }),
    };
};
