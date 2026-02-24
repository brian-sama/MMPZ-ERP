// Health check endpoint - Netlify Function
// Simple test to verify functions are working

export const handler = async (event) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
            status: 'ok',
            message: 'MMPZ API is running on Neon',
            timestamp: new Date().toISOString(),
            env: {
                hasDatabaseUrl: !!process.env.DATABASE_URL,
                provider: 'Neon PostgreSQL'
            }
        })
    };
};
