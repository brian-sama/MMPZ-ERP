
import { sql } from './utils/db.js';

export const handler = async (event) => {
    try {
        console.log("Testing DB connection...");
        const start = Date.now();
        const result = await sql`SELECT 1 as connected`;
        const duration = Date.now() - start;
        console.log("DB connected in", duration, "ms");

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: "success",
                result: result,
                duration: duration
            })
        };
    } catch (error) {
        console.error("DB connection failed:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                status: "error",
                message: error.message,
                stack: error.stack
            })
        };
    }
};
