import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function backfill() {
    console.log('Starting finance backfill...');
    try {
        await sql.begin(async (tx) => {
            // 1. Get unique donors from projects
            const projectDonors = await tx`SELECT DISTINCT donor FROM projects WHERE donor IS NOT NULL`;

            for (const d of projectDonors) {
                await tx`
                    INSERT INTO donors (name, code)
                    VALUES (${d.donor}, UPPER(LEFT(${d.donor}, 10)))
                    ON CONFLICT (name) DO NOTHING
                `;
            }

            // Ensure a default donor
            const defaultDonor = await tx`
                INSERT INTO donors (name, code) VALUES ('General Funding', 'GEN')
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            `;

            // 2. Map Projects to grants and budgets
            const projects = await tx`SELECT id, name, donor, start_date, end_date FROM projects`;

            for (const p of projects) {
                const donor = await tx`SELECT id FROM donors WHERE name = ${p.donor || 'General Funding'}`;
                const donorId = donor[0]?.id || defaultDonor[0].id;

                // Create a Grant for this project
                const grant = await tx`
                    INSERT INTO grants (donor_id, name, start_date, end_date)
                    VALUES (${donorId}, ${p.name + ' Grant'}, ${p.start_date}, ${p.end_date})
                    RETURNING id
                `;

                // Create a Budget for the project
                const budget = await tx`
                    INSERT INTO budgets (grant_id, project_id, name)
                    VALUES (${grant[0].id}, ${p.id}, ${p.name + ' Primary Budget'})
                    RETURNING id
                `;

                // 3. Map Indicators linked to this project into budget lines
                const indicators = await tx`
                    SELECT id, title, total_budget, current_budget_balance 
                    FROM indicators WHERE project_id = ${p.id}
                `;

                for (const ind of indicators) {
                    await tx`
                        INSERT INTO budget_lines (budget_id, code, description, allocated_amount, used_amount)
                        VALUES (
                            ${budget[0].id}, 
                            ${'IND-' + ind.id}, 
                            ${ind.title}, 
                            ${ind.total_budget}, 
                            ${ind.total_budget - ind.current_budget_balance}
                        )
                    `;
                }
            }
        });

        console.log('✅ Finance backfill completed.');
    } catch (err) {
        console.error('❌ Finance backfill failed:', err);
    } finally {
        await sql.end();
    }
}

backfill();
