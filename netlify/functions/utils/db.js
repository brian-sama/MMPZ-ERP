import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL environment variable');
}

// Create and export Postgres.js client
// options can be passed as a second argument if needed (e.g. { ssl: 'require' })
const sql = postgres(databaseUrl);

export { sql };

/**
 * Helper to run a query and return results
 * This mimics some of the behavior needed for easier migration
 */
export const query = async (queryString, params = []) => {
    try {
        // Postgres.js uses tagged template literals for queries mostly
        // But for dynamic queries from strings if absolutely needed, we might need unsafe
        // However, looking at the previous usage, it seems to expect 'sql' to be used mainly.
        // If this 'query' helper is used with raw strings, we might need:
        const result = await sql.unsafe(queryString, params);
        return { data: result, error: null };
    } catch (error) {
        console.error('Database query error:', error);
        return { data: null, error };
    }
};

// Export as default as well
export default sql;
