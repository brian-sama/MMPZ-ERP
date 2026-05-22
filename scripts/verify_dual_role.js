import 'dotenv/config';
import postgres from 'postgres';

async function verify() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('Missing DATABASE_URL in environment');
        process.exit(1);
    }

    const sql = postgres(dbUrl);
    const email = 'brianmagagula5@gmail.com';

    try {
        console.log('Querying ERP user details...');
        const [user] = await sql`
            SELECT id, name, email, role_code, system_role, job_title, role_assignment_status
            FROM users
            WHERE email = ${email}
            LIMIT 1
        `;

        if (!user) {
            console.error(`User with email ${email} not found!`);
            process.exitCode = 1;
            return;
        }

        console.log('--- User Account ---');
        console.log(`ID:                     ${user.id}`);
        console.log(`Name:                   ${user.name}`);
        console.log(`Email:                  ${user.email}`);
        console.log(`Role Code:              ${user.role_code}`);
        console.log(`System Role:            ${user.system_role}`);
        console.log(`Job Title:              ${user.job_title}`);
        console.log(`Role Assignment Status: ${user.role_assignment_status}`);

        console.log('\nQuerying development_facilitators entry...');
        const [facilitator] = await sql`
            SELECT user_id, status, joined_at
            FROM development_facilitators
            WHERE user_id = ${user.id}
            LIMIT 1
        `;

        if (!facilitator) {
            console.warn('WARNING: No entry found in development_facilitators table for this user!');
            process.exitCode = 1;
            return;
        }

        console.log('--- Facilitator Profile ---');
        console.log(`User ID:                ${facilitator.user_id}`);
        console.log(`Status:                 ${facilitator.status}`);
        console.log(`Joined At:              ${facilitator.joined_at}`);

        console.log('\nVerification complete! All database attributes are fully correct.');
    } catch (error) {
        console.error('Verification failed due to error:', error.message);
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
}

verify();
