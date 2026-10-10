import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sourceAdminEmail =
    process.env.TRAINING_RESET_SOURCE_EMAIL?.trim() || 'brianmagagula5@gmail.com';
const retainedAdminEmail =
    process.env.TRAINING_RESET_ADMIN_EMAIL?.trim() || 'briandmagagula@gmail.com';
const preservedTables = [
    'roles',
    'permissions',
    'role_permissions',
    'users',
    'system_settings',
    'kobo_config',
    'schema_migrations',
    '_prisma_migrations',
];

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable.');
    process.exit(1);
}

if (!sourceAdminEmail || !retainedAdminEmail) {
    console.error('Both reset admin email addresses must be provided.');
    process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

const run = async () => {
    try {
        let truncatedTableCount = 0;

        await sql.begin(async (tx) => {
            const admins = await tx`
                SELECT
                    u.id,
                    u.email,
                    u.role_code,
                    u.system_role,
                    EXISTS (
                        SELECT 1
                        FROM roles r
                        WHERE r.code = u.role_code
                          AND LOWER(r.name) IN ('system administrator', 'administrator')
                    ) AS role_is_admin
                FROM users u
                WHERE LOWER(u.email) = LOWER(${sourceAdminEmail})
                   OR LOWER(u.email) = LOWER(${retainedAdminEmail})
                FOR UPDATE
            `;

            if (admins.length === 0) {
                throw new Error(
                    `No admin account was found for ${sourceAdminEmail} or ${retainedAdminEmail}.`,
                );
            }
            if (admins.length > 1) {
                throw new Error(
                    `Both ${sourceAdminEmail} and ${retainedAdminEmail} exist as separate accounts; refusing to choose one.`,
                );
            }

            const admin = admins[0];
            const systemRole = String(admin.system_role || '').toUpperCase();
            const roleCode = String(admin.role_code || '').toUpperCase();
            if (
                !admin.role_is_admin &&
                !['ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'].includes(systemRole) &&
                !['ADMIN', 'SYSTEM_ADMIN'].includes(roleCode)
            ) {
                throw new Error(
                    `The account ${admin.email} does not have an administrator role; no data was changed.`,
                );
            }

            const tables = await tx`
                SELECT format('%I.%I', schemaname, tablename) AS qualified_name
                FROM pg_tables
                WHERE schemaname = 'public'
                  AND tablename <> ALL(${preservedTables}::text[])
                ORDER BY tablename
            `;
            if (tables.length === 0) {
                throw new Error('No data tables were found to clear; no data was changed.');
            }

            const tableNames = tables.map((table) => table.qualified_name).join(', ');
            await tx.unsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
            truncatedTableCount = tables.length;

            await tx`
                DELETE FROM users
                WHERE id <> ${admin.id}
            `;
            await tx`
                UPDATE users
                SET email = ${retainedAdminEmail}
                WHERE id = ${admin.id}
                  AND email <> ${retainedAdminEmail}
            `;
        });

        console.log(
            `Training reset complete. Cleared ${truncatedTableCount} data tables; retained the admin account as ${retainedAdminEmail}, along with roles, permissions, system settings, Kobo configuration, and migration history.`,
        );
    } catch (error) {
        console.error(
            'Training reset failed; the transaction was rolled back:',
            error instanceof Error ? error.message : String(error),
        );
        process.exitCode = 1;
    } finally {
        await sql.end();
    }
};

run();
