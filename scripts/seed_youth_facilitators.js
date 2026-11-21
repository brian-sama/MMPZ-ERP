import 'dotenv/config';
import { sql } from '../server/api/utils/db.js';
import { hashPassword } from '../server/api/utils/auth.js';
import { ensureFacilitatorProfile } from '../server/api/utils/facilitators.js';

// Roster of Facilitators to create in MMPZ-ERP
export const FACILITATORS = [
    // Slot #1 from screenshot - update when confirmed
    { name: 'Facilitator 1', email: 'facilitator1@mmpz.org' },
    { name: 'Bahle Hleza', email: 'hlezabahle856@gmail.com' },
    { name: 'Lorraine Sibanda', email: 'lolosibs23@gmail.com' },
    { name: 'Mandisa Tsambani', email: 'mandisatsambani05@gmail.com' },
    { name: 'Thandiwe Muza', email: 'muzathandiwe63@gmail.com' },
    { name: 'Taina Dlodlo', email: 'tainadlodlo20@gmail.com' },
    { name: 'Tanaka Mahaso', email: 'tanakamahaso27@gmail.com' },
    { name: 'Thoboka Ndlovu', email: 'thobokandlovu481@gmail.com' },
    { name: 'Tholubuhle Tshuma', email: 'tholubuhletshuma@gmail.com' },
    { name: 'Xetshelihle Ngwenya', email: 'xetshelihlegngwenya@gmail.com' },
];

const INITIAL_PASSWORD = '12345678';
const ROLE_CODE = 'YOUTH_FACILITATOR_PEER_EDUCATOR';
const SYSTEM_ROLE = 'FACILITATOR';
const JOB_TITLE = 'Youth Facilitator / Peer Educator';
const REQUIRE_PASSWORD_RESET = false;

async function seedFacilitators() {
    console.log(`\n========================================`);
    console.log(`🚀 MMPZ-ERP: Seeding Youth Facilitators`);
    console.log(`========================================\n`);

    const passwordHash = await hashPassword(INITIAL_PASSWORD);

    try {
        for (const [index, person] of FACILITATORS.entries()) {
            const email = person.email.trim().toLowerCase();
            const name = person.name.trim();

            console.log(`[${index + 1}/${FACILITATORS.length}] Processing: ${name} <${email}>...`);

            const existing = await sql`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;

            let userId;
            if (existing.length > 0) {
                userId = existing[0].id;
                await sql`
                    UPDATE users
                    SET
                        name = ${name},
                        password_hash = ${passwordHash},
                        role_code = ${ROLE_CODE},
                        system_role = ${SYSTEM_ROLE},
                        job_title = ${JOB_TITLE},
                        role_assignment_status = 'confirmed',
                        role_confirmed_at = CURRENT_TIMESTAMP,
                        require_password_reset = ${REQUIRE_PASSWORD_RESET}
                    WHERE id = ${userId}
                `;
                console.log(`   ✅ Updated existing user (ID: ${userId})`);
            } else {
                const inserted = await sql`
                    INSERT INTO users (
                        name,
                        email,
                        password_hash,
                        role_code,
                        system_role,
                        job_title,
                        role_assignment_status,
                        role_confirmed_at,
                        require_password_reset
                    )
                    VALUES (
                        ${name},
                        ${email},
                        ${passwordHash},
                        ${ROLE_CODE},
                        ${SYSTEM_ROLE},
                        ${JOB_TITLE},
                        'confirmed',
                        CURRENT_TIMESTAMP,
                        ${REQUIRE_PASSWORD_RESET}
                    )
                    RETURNING id
                `;
                userId = inserted[0].id;
                console.log(`   ✨ Created new user (ID: ${userId})`);
            }

            // Sync development_facilitators profile table if it exists
            try {
                await ensureFacilitatorProfile(sql, {
                    userId,
                    joinedAt: new Date().toISOString(),
                    activate: true,
                });
                console.log(`   📋 Linked to development_facilitators profile`);
            } catch (err) {
                // Table might not exist in all environments
            }
        }

        console.log(`\n🎉 Successfully processed all ${FACILITATORS.length} facilitators in MMPZ-ERP!`);
        console.log(`Initial password set to: ${INITIAL_PASSWORD} (Password reset disabled)`);
    } catch (err) {
        console.error('\n❌ Seeding failed:', err.message);
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
}

seedFacilitators();

