import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres({
    host: 'localhost',
    port: 5432,
    database: 'mmpz_erp_local',
    username: 'postgres',
    password: 'Brian7350$@#',
    ssl: false
});

async function migrate() {
    console.log('Running Announcements table migration...');
    try {
        await sql`
            CREATE EXTENSION IF NOT EXISTS pgcrypto;
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS announcements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                author_id INT REFERENCES users(id) ON DELETE SET NULL,
                audience TEXT[] NOT NULL DEFAULT ARRAY['ALL'],
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await sql`
            UPDATE announcements
            SET audience = ARRAY['ALL']
            WHERE audience IS NULL OR array_length(audience, 1) IS NULL
        `;
        await sql`ALTER TABLE announcements ALTER COLUMN audience SET DEFAULT ARRAY['ALL']`;
        console.log('Announcements table created.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sql.end();
    }
}

migrate();
