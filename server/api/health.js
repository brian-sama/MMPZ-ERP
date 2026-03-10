// Health check endpoint.
// Simple test to verify functions are working

export const handler = async (event) => {
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    const provider = hasDatabaseUrl
        ? (process.env.DATABASE_URL.includes('localhost') ? 'Local PostgreSQL' : 'PostgreSQL')
        : 'Not configured';

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
            status: 'ok',
            message: 'MMPZ API is running',
            timestamp: new Date().toISOString(),
            env: {
                hasDatabaseUrl,
                provider,
            },
        }),
    };
};
