// Run audit migration
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
    console.log('Running audit migration...');

    try {
        // 1. Drop and recreate the constraint with new values
        console.log('Updating approval_status constraint...');
        await sql`ALTER TABLE progress_updates DROP CONSTRAINT IF EXISTS progress_updates_approval_status_check`;
        await sql`ALTER TABLE progress_updates ADD CONSTRAINT progress_updates_approval_status_check 
            CHECK (approval_status IN ('pending', 'approved', 'rejected', 'awaiting_audit', 'audited'))`;
        console.log('✓ Constraint updated');

        // 2. Add new columns for audit tracking
        console.log('Adding tally_value column...');
        await sql`ALTER TABLE progress_updates ADD COLUMN IF NOT EXISTS tally_value INT DEFAULT NULL`;
        console.log('✓ tally_value column added');

        console.log('Adding tally_status column...');
        await sql`ALTER TABLE progress_updates ADD COLUMN IF NOT EXISTS tally_status JSONB DEFAULT NULL`;
        console.log('✓ tally_status column added');

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
