
export const handler = async (sql) => {
    console.log('Running migration: 001_add_lockout_columns.js');
    
    // Add columns if they don't exist
    await sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP NULL;
    `;
    
    console.log('Migration 001_add_lockout_columns.js completed.');
};
