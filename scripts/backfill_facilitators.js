import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function backfill() {
    console.log('Starting facilitator backfill...');
    try {
        const result = await sql.begin(async (tx) => {
            // 1. Identify all users with facilitator roles
            const users = await tx`
                SELECT id, created_at 
                FROM users 
                WHERE role_code = 'DEVELOPMENT_FACILITATOR'
            `;

            console.log(`Found ${users.length} facilitators in users table.`);

            let count = 0;
            for (const user of users) {
                // 2. Insert into development_facilitators if not exists
                await tx`
                    INSERT INTO development_facilitators (user_id, status, joined_at)
                    VALUES (${user.id}, 'active', ${user.created_at})
                    ON CONFLICT (user_id) DO NOTHING
                `;
                count++;
            }

            return count;
        });

        console.log(`✅ Backfilled ${result} facilitator profiles.`);
    } catch (err) {
        console.error('❌ Backfill failed:', err);
    } finally {
        await sql.end();
    }
}

backfill();
