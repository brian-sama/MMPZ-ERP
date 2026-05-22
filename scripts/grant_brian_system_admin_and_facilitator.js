import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
}

const sql = postgres(databaseUrl);

const targetEmail = process.env.TARGET_EMAIL || 'brianmagagula5@gmail.com';
const targetName = process.env.TARGET_NAME || 'Brian Magagula';
const targetRoleCode = 'SYSTEM_ADMIN';
const targetSystemRole = 'SUPER_ADMIN';
const targetJobTitle = 'System Administrator / Development Facilitator';

async function ensureSystemAdminRole(tx) {
    await tx`
        INSERT INTO roles (code, name, description, is_executive)
        VALUES (
            ${targetRoleCode},
            ${'System Administrator'},
            ${'Highest level of administrative access and control.'},
            ${true}
        )
        ON CONFLICT (code) DO UPDATE
        SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_executive = EXCLUDED.is_executive
    `;

    await tx`
        INSERT INTO role_permissions (role_code, permission_code)
        SELECT ${targetRoleCode}, code
        FROM permissions
        ON CONFLICT (role_code, permission_code) DO NOTHING
    `;
}

async function grantAccess() {
    try {
        const result = await sql.begin(async (tx) => {
            await ensureSystemAdminRole(tx);

            const existingUsers = await tx`
                SELECT id, name, email, role_code, system_role, created_at
                FROM users
                WHERE email = ${targetEmail}
                LIMIT 1
            `;

            if (existingUsers.length === 0) {
                throw new Error(`User not found for email ${targetEmail}`);
            }

            const existingUser = existingUsers[0];

            await tx`
                UPDATE users
                SET
                    name = COALESCE(name, ${targetName}),
                    role_code = ${targetRoleCode},
                    system_role = ${targetSystemRole},
                    job_title = ${targetJobTitle},
                    role_assignment_status = 'confirmed',
                    role_confirmed_at = CURRENT_TIMESTAMP,
                    role_legacy_snapshot = COALESCE(role_legacy_snapshot, ${existingUser.role_code || targetRoleCode}),
                    require_password_reset = FALSE,
                    failed_login_attempts = 0,
                    locked_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${existingUser.id}
            `;

            await tx`
                INSERT INTO development_facilitators (user_id, status, joined_at)
                VALUES (${existingUser.id}, 'active', ${existingUser.created_at || new Date()})
                ON CONFLICT (user_id) DO UPDATE
                SET status = 'active'
            `;

            if (existingUser.role_code !== targetRoleCode) {
                await tx`
                    INSERT INTO user_role_history (
                        user_id,
                        previous_role_code,
                        new_role_code,
                        changed_by_user_id,
                        reason
                    )
                    VALUES (
                        ${existingUser.id},
                        ${existingUser.role_code},
                        ${targetRoleCode},
                        ${existingUser.id},
                        ${'Elevated to System Administrator while retaining facilitator profile'}
                    )
                `;
            }

            const updatedUsers = await tx`
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.role_code,
                    u.system_role,
                    u.job_title,
                    u.role_assignment_status,
                    df.status AS facilitator_status,
                    df.joined_at AS facilitator_joined_at
                FROM users u
                LEFT JOIN development_facilitators df ON df.user_id = u.id
                WHERE u.id = ${existingUser.id}
                LIMIT 1
            `;

            return updatedUsers[0];
        });

        console.log('Updated user successfully:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Failed to grant Brian system admin and facilitator access:', error.message);
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
}

grantAccess();
