import 'dotenv/config';
import postgres from 'postgres';

async function main() {
    const erpDbUrl = process.env.DATABASE_URL;
    if (!erpDbUrl) {
        console.error('Missing DATABASE_URL in environment');
        process.exit(1);
    }

    // Compass DB url is standard based on the compass .env
    const compassDbUrl = 'postgresql://mmpz:mmpz@localhost:5432/mmpz_compass';

    console.log('Connecting to ERP database...');
    const erpSql = postgres(erpDbUrl);

    console.log('Connecting to Compass database...');
    const compassSql = postgres(compassDbUrl);

    const email = 'brianmagagula5@gmail.com';
    const newName = 'Brian Dumolwenkosi Magagula';

    try {
        console.log(`Updating ERP database user: ${email} to ${newName}`);
        const erpUpdate = await erpSql`
            UPDATE users
            SET name = ${newName}, updated_at = CURRENT_TIMESTAMP
            WHERE email = ${email}
            RETURNING id, name, email
        `;
        console.log('ERP Update Result:', erpUpdate);

        console.log(`Updating Compass database user: ${email} to ${newName}`);
        let compassUpdate;
        try {
            compassUpdate = await compassSql`
                UPDATE "User"
                SET name = ${newName}, "updatedAt" = CURRENT_TIMESTAMP
                WHERE email = ${email}
                RETURNING id, name, email
            `;
            console.log('Compass "User" Update Result:', compassUpdate);
        } catch (err) {
            console.log('Failed updating "User" table directly, trying "users":', err.message);
            try {
                compassUpdate = await compassSql`
                    UPDATE users
                    SET name = ${newName}, updated_at = CURRENT_TIMESTAMP
                    WHERE email = ${email}
                    RETURNING id, name, email
                `;
                console.log('Compass "users" Update Result:', compassUpdate);
            } catch (err2) {
                console.error('Could not update user in Compass database:', err2.message);
            }
        }
        
        console.log('Database name standardization completed successfully!');
    } catch (error) {
        console.error('Error during database update:', error);
    } finally {
        await erpSql.end();
        await compassSql.end();
    }
}

main();
