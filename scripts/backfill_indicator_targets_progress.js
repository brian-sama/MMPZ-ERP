import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function backfill() {
    console.log('Starting M&E targets and progress backfill...');
    try {
        await sql.begin(async (tx) => {
            // 1. Fetch current indicators to create base targets
            const indicators = await tx`SELECT id, target_value, created_at FROM indicators`;

            for (const ind of indicators) {
                const date = new Date(ind.created_at || Date.now());
                const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                // Create a target for the creation month
                await tx`
                    INSERT INTO indicator_targets (indicator_id, reporting_period, target_value)
                    VALUES (${ind.id}, ${period}, ${ind.target_value})
                    ON CONFLICT (indicator_id, reporting_period) DO NOTHING
                `;
            }

            // 2. Fetch all legacy progress updates
            const updates = await tx`
                SELECT id, indicator_id, updated_by_user_id, new_value, notes, approval_status, update_date 
                FROM progress_updates
            `;

            console.log(`Mapping ${updates.length} progress updates to canonical table...`);

            for (const up of updates) {
                const date = new Date(up.update_date);
                const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                // Ensure target exists for this period (even if default 0 or the indicator's total)
                const target = await tx`
                    INSERT INTO indicator_targets (indicator_id, reporting_period, target_value)
                    VALUES (${up.indicator_id}, ${period}, (SELECT target_value FROM indicators WHERE id = ${up.indicator_id}))
                    ON CONFLICT (indicator_id, reporting_period) DO UPDATE SET indicator_id = EXCLUDED.indicator_id
                    RETURNING id
                `;

                // Insert into canonical indicator_progress
                await tx`
                    INSERT INTO indicator_progress (
                        indicator_id, 
                        target_id, 
                        reporting_period, 
                        value, 
                        notes, 
                        reported_by_user_id, 
                        status, 
                        created_at
                    )
                    VALUES (
                        ${up.indicator_id}, 
                        ${target[0].id}, 
                        ${period}, 
                        ${up.new_value}, 
                        ${up.notes}, 
                        ${up.updated_by_user_id}, 
                        ${up.approval_status === 'approved' ? 'approved' : up.approval_status === 'rejected' ? 'rejected' : 'pending'}, 
                        ${up.update_date}
                    )
                `;
            }
        });

        console.log('✅ M&E backfill completed.');
    } catch (err) {
        console.error('❌ M&E backfill failed:', err);
    } finally {
        await sql.end();
    }
}

backfill();
