import { sql } from '../server/api/utils/db.js';

async function fix() {
    try {
        console.log('Fixing volunteer_submissions_type_check constraint...');
        
        // 1. Drop existing constraint
        await sql`ALTER TABLE volunteer_submissions DROP CONSTRAINT IF EXISTS volunteer_submissions_type_check`;
        
        // 2. Add new constraint with all known types
        await sql`
            ALTER TABLE volunteer_submissions
            ADD CONSTRAINT volunteer_submissions_type_check
            CHECK (
                type IN (
                    'plan',
                    'concept_note',
                    'report',
                    'scanned_list',
                    'activity_plan',
                    'activity_report',
                    'leave_application',
                    'request_for_funds_plan'
                )
            )
        `;
        
        console.log('Constraint updated successfully.');
        process.exit(0);
    } catch (e) {
        console.error('Failed to update constraint:', e);
        process.exit(1);
    }
}

fix();
