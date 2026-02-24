
import { sql } from './utils/db.js';

export const handler = async (event) => {
    try {
        console.log("Migration Step 1: Updating User Roles");

        // Split into two atomic operations
        try {
            await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`;
            console.log("Dropped constraint");
        } catch (e) {
            console.log("Drop constraint warning:", e.message);
        }

        await sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'director', 'officer', 'intern', 'volunteer'))`;
        console.log("Added new constraint");

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Roles updated" })
        };
    } catch (error) {
        console.error("Role update failed:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
