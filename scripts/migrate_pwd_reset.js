
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function migrate() {
    try {
        console.log('Starting migration...');

        // Check if column exists
        const columnCheck = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'require_password_reset'
        `;

        if (columnCheck.length === 0) {
            console.log('Adding require_password_reset column...');
            await sql`ALTER TABLE users ADD COLUMN require_password_reset BOOLEAN DEFAULT FALSE`;
            console.log('Column added successfully.');
        } else {
            console.log('Column already exists.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
