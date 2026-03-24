export const handler = async (sql) => {
    console.log('Running RBAC migration (restructured)...');
    
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS system_role TEXT;`;
    
    const mapping = {
        'DIRECTOR': 'MANAGEMENT',
        'FINANCE_ADMIN_OFFICER': 'PROGRAM_STAFF',
        'ADMIN_ASSISTANT': 'OPERATIONS',
        'LOGISTICS_ASSISTANT': 'OPERATIONS',
        'PSYCHOSOCIAL_SUPPORT_OFFICER': 'PROGRAM_STAFF',
        'COMMUNITY_DEVELOPMENT_OFFICER': 'PROGRAM_STAFF',
        'ME_INTERN_ACTING_OFFICER': 'INTERN',
        'SOCIAL_SERVICES_INTERN': 'INTERN',
        'YOUTH_COMMUNICATIONS_INTERN': 'INTERN',
        'DEVELOPMENT_FACILITATOR': 'FACILITATOR',
        'SYSTEM_ADMIN': 'SUPER_ADMIN'
    };

    const users = await sql`SELECT id, role_code, name FROM users WHERE system_role IS NULL`;
    for (const user of users) {
        const systemRole = mapping[user.role_code] || 'INTERN';
        await sql`
            UPDATE users 
            SET 
                system_role = ${systemRole},
                job_title = role_code 
            WHERE id = ${user.id}
        `;
        console.log(`Updated ${user.name} (ID: ${user.id}) to ${systemRole}`);
    }

    console.log('RBAC migration complete.');
};
