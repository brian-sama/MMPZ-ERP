
import { sql } from './utils/db.js';

export const handler = async (event) => {
    try {
        console.log("Migration Step 3: Schema Updates for Volunteer Reporting");

        // 1. Add kobo_submission_id to participants (to prevent duplicates)
        await sql`
            ALTER TABLE volunteer_participants 
            ADD COLUMN IF NOT EXISTS kobo_submission_id VARCHAR(50) UNIQUE
        `;
        console.log("Updated volunteer_participants");

        // 2. Create volunteer_activity_reports table
        await sql`
            CREATE TABLE IF NOT EXISTS volunteer_activity_reports (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                indicator_id INT NOT NULL,
                male_count INT DEFAULT 0,
                female_count INT DEFAULT 0,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        console.log("Created volunteer_activity_reports");

        // 3. Update kobo_form_links for approval workflow
        // Add columns if they don't exist
        await sql`
            ALTER TABLE kobo_form_links 
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved',
            ADD COLUMN IF NOT EXISTS requested_by INT
        `;
        console.log("Updated kobo_form_links");

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Schema updated successfully" })
        };
    } catch (error) {
        console.error("Migration failed:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
