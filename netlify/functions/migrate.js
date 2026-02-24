
import { sql } from './utils/db.js';

export const handler = async (event) => {
    try {
        console.log("Starting migration...");

        // 1. Update User Roles
        await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`;
        await sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'director', 'officer', 'intern', 'volunteer'))`;
        console.log("Updated users role check");

        // 2. Create Volunteer Submissions Table
        await sql`
            CREATE TABLE IF NOT EXISTS volunteer_submissions (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                type VARCHAR(50) CHECK (type IN ('plan', 'concept_note', 'report', 'scanned_list')) NOT NULL,
                file_data TEXT,
                file_name VARCHAR(255),
                mime_type VARCHAR(100),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `;
        console.log("Created volunteer_submissions table");

        // 3. Create Volunteer Participants Table
        await sql`
            CREATE TABLE IF NOT EXISTS volunteer_participants (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                age INT,
                gender VARCHAR(20),
                contact VARCHAR(100),
                event_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `;
        console.log("Created volunteer_participants table");

        // 4. Create Indexes (Using catch to ignore if exists)
        try { await sql`CREATE INDEX idx_volunteer_submissions_user ON volunteer_submissions(user_id)`; } catch (e) { }
        try { await sql`CREATE INDEX idx_volunteer_participants_user ON volunteer_participants(user_id)`; } catch (e) { }
        console.log("Created indexes");

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Migration completed successfully" })
        };
    } catch (error) {
        console.error("Migration failed:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
