
import { sql } from './utils/db.js';

export const handler = async (event) => {
    try {
        console.log("Migration Step 2: Creating Tables");

        await sql`
            CREATE TABLE IF NOT EXISTS volunteer_submissions (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                type VARCHAR(50) NOT NULL,
                file_data TEXT,
                file_name VARCHAR(255),
                mime_type VARCHAR(100),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        // Removed FK constraint temporarily to rely on app logic if DB is strict,
        // but typically better to keep it. Retrying with simpler definition first.

        console.log("Created volunteer_submissions");

        await sql`
            CREATE TABLE IF NOT EXISTS volunteer_participants (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                age INT,
                gender VARCHAR(20),
                contact VARCHAR(100),
                event_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        console.log("Created volunteer_participants");

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Tables created" })
        };
    } catch (error) {
        console.error("Table creation failed:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
